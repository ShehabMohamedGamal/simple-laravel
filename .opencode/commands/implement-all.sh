#!/bin/sh
set -eu

launcher=$(pwd)
repo_name=$(basename "$launcher")
worktree_parent=$(cd "$launcher/.." && pwd)/${repo_name}-worktrees
copy_paths=${OPENCODE_WORKTREE_COPY_PATHS:-".env vendor node_modules public/build"}
attempted=""
succeeded=""

extract_claimed_id() {
    php -r '
        $json = null;
        foreach (file("php://stdin") as $line) {
            $line = trim($line);
            if ($line === "") {
                continue;
            }
            $first = $line[0];
            if ($first === "[" || $first === "{") {
                $json = $line;
                break;
            }
        }

        if ($json === null) {
            exit(0);
        }

        $data = json_decode($json, true);
        if (! is_array($data)) {
            exit(0);
        }

        $issue = null;
        if (array_is_list($data)) {
            $issue = $data[0] ?? null;
        } elseif (isset($data["id"])) {
            $issue = $data;
        } elseif (isset($data["issue"]) && is_array($data["issue"])) {
            $issue = $data["issue"];
        } elseif (isset($data["issues"][0]) && is_array($data["issues"][0])) {
            $issue = $data["issues"][0];
        } elseif (isset($data["items"][0]) && is_array($data["items"][0])) {
            $issue = $data["items"][0];
        }

        if (is_array($issue) && isset($issue["id"])) {
            echo $issue["id"];
        }
    '
}

claim_next_ticket() {
    bd -C "$launcher" ready -t implementation --exclude-label implementation-failed --claim --json | extract_claimed_id
}

write_prompt() {
    ticket_id=$1
    worktree=$2
    result_file=$3
    prompt_file=$worktree/.opencode-ticket-prompt.md

    cat > "$prompt_file" <<EOF_PROMPT
Implement Beads ticket $ticket_id in this worktree: $worktree

Launcher checkout: $launcher
Beads commands must run against the launcher checkout with: bd -C "$launcher" ...
Result file: $result_file

Rules:

- You are the implementation agent for one ticket only.
- Work only in this worktree.
- Do not start or inspect other implementation tickets.
- Run bd -C "$launcher" show $ticket_id before coding.
- Record the fixed point with git rev-parse HEAD before edits.
- Follow the implement-loop skill exactly: it owns the todo list built from the ticket acceptance criteria, tdd-lite during build, the wrap-up gates through sh .opencode/gates/loop-log.sh, and one /self-review run with the fixed point and ticket id.
- The self-review run is the only subagent you may launch.
- Do not push git refs or Beads sync data.

Success contract:

- Commit the ticket work in this worktree.
- Close the ticket with bd -C "$launcher" close $ticket_id --reason="Completed".
- Write this exact result file:

status=success
commit=<commit-sha>
summary=<one-line summary>

Failure contract:

- Leave this worktree and branch intact.
- Mark the ticket with bd -C "$launcher" update $ticket_id --status open --add-label implementation-failed --add-label ready-for-human --remove-label ready-for-agent --append-notes "Implementation loop failed. Worktree: $worktree. See the created follow-up issue and run log."
- Create the ready-for-human Beads issue required by implement-loop with the run log body.
- Write this exact result file:

status=failure
followup=<follow-up-issue-id-or-none>
summary=<one-line reason>
EOF_PROMPT

    printf '%s\n' "$prompt_file"
}

read_result_value() {
    result_file=$1
    key=$2
    if [ ! -f "$result_file" ]; then
        return 0
    fi
    sed -n "s/^$key=//p" "$result_file" | sed -n '1p'
}

copy_path_into_worktree() {
    path=$1
    source=$launcher/$path
    destination=$worktree/$path
    parent=$(dirname "$destination")

    if [ ! -e "$source" ]; then
        return 0
    fi

    mkdir -p "$parent"
    rm -rf "$destination"
    cp -a "$source" "$destination"
    printf 'Copied %s\n' "$path"
}

hydrate_worktree() {
    printf 'Hydrating worktree dependencies and runtime files.\n'

    for path in $copy_paths; do
        copy_path_into_worktree "$path"
    done

    mkdir -p "$worktree/storage/framework/cache/data"
    mkdir -p "$worktree/storage/framework/sessions"
    mkdir -p "$worktree/storage/framework/views"
    mkdir -p "$worktree/bootstrap/cache"

    if [ -d "$worktree/vendor" ]; then
        printf 'Refreshing Composer autoload in worktree.\n'
        (cd "$worktree" && composer dump-autoload)
    fi

    if [ -f "$worktree/artisan" ] && [ -d "$worktree/vendor" ]; then
        printf 'Clearing Laravel cached bootstrap files in worktree.\n'
        (cd "$worktree" && php artisan optimize:clear) || printf 'Laravel cache clear failed; implementation agent will handle it.\n'
    fi
}

mkdir -p "$worktree_parent"
printf 'Running AFK implementation loop from %s\n' "$launcher"
printf 'Worktrees parent: %s\n' "$worktree_parent"
printf 'Copied into each worktree: %s\n' "$copy_paths"

bd -C "$launcher" prime >/dev/null || bd -C "$launcher" prime

while :; do
    ticket_id=$(claim_next_ticket)

    if [ -z "$ticket_id" ]; then
        printf '\nNo ready unfailed implementation tickets remain.\n'
        break
    fi

    attempted="$attempted $ticket_id"
    branch=agent/$ticket_id
    worktree=$worktree_parent/$ticket_id
    result_file=$worktree/.opencode-ticket-result

    printf '\nClaimed %s\n' "$ticket_id"

    if [ -e "$worktree" ]; then
        printf 'Worktree already exists: %s\n' "$worktree"
        bd -C "$launcher" update "$ticket_id" --status open --add-label implementation-failed --add-label ready-for-human --remove-label ready-for-agent --append-notes "Implementation loop stopped before coding because worktree already exists: $worktree"
        break
    fi

    if git -C "$launcher" show-ref --verify --quiet "refs/heads/$branch"; then
        printf 'Branch already exists: %s\n' "$branch"
        bd -C "$launcher" update "$ticket_id" --status open --add-label implementation-failed --add-label ready-for-human --remove-label ready-for-agent --append-notes "Implementation loop stopped before coding because branch already exists: $branch"
        break
    fi

    git -C "$launcher" worktree add -b "$branch" "$worktree" HEAD

    if ! hydrate_worktree; then
        printf '\nFailed to hydrate worktree for %s.\n' "$ticket_id"
        printf 'Worktree kept for inspection: %s\n' "$worktree"
        bd -C "$launcher" update "$ticket_id" --status open --add-label implementation-failed --add-label ready-for-human --remove-label ready-for-agent --append-notes "Implementation loop stopped before coding because worktree hydration failed. Worktree: $worktree. Branch: $branch."
        break
    fi

    prompt_file=$(write_prompt "$ticket_id" "$worktree" "$result_file")

    set +e
    opencode run --agent implementer --auto --dir "$worktree" --title "Implement $ticket_id" "$(cat "$prompt_file")"
    run_status=$?
    set -e

    status=$(read_result_value "$result_file" status)
    commit=$(read_result_value "$result_file" commit)
    summary=$(read_result_value "$result_file" summary)
    followup=$(read_result_value "$result_file" followup)

    if [ "$run_status" -ne 0 ] || [ "$status" != "success" ]; then
        printf '\nTicket %s failed.\n' "$ticket_id"
        printf 'Run status: %s\n' "$run_status"
        printf 'Worktree: %s\n' "$worktree"
        printf 'Branch: %s\n' "$branch"
        if [ -n "$summary" ]; then
            printf 'Summary: %s\n' "$summary"
        fi
        if [ -n "$followup" ]; then
            printf 'Follow-up: %s\n' "$followup"
        fi
        bd -C "$launcher" update "$ticket_id" --status open --add-label implementation-failed --add-label ready-for-human --remove-label ready-for-agent --append-notes "Implementation loop failed or did not report success. Worktree: $worktree. Branch: $branch."
        break
    fi

    if ! git -C "$worktree" diff --quiet || ! git -C "$worktree" diff --cached --quiet; then
        printf '\nTicket %s reported success but left dirty changes.\n' "$ticket_id"
        printf 'Worktree kept for inspection: %s\n' "$worktree"
        bd -C "$launcher" update "$ticket_id" --status open --add-label implementation-failed --add-label ready-for-human --remove-label ready-for-agent --append-notes "Implementation loop reported success but left dirty changes. Worktree: $worktree. Branch: $branch."
        break
    fi

    git -C "$launcher" worktree remove "$worktree"
    succeeded="$succeeded $ticket_id"
    printf '\nTicket %s succeeded.\n' "$ticket_id"
    printf 'Branch: %s\n' "$branch"
    if [ -n "$commit" ]; then
        printf 'Commit: %s\n' "$commit"
    fi
    printf 'Cleaned worktree: %s\n' "$worktree"
done

printf '\nAFK implementation loop stopped.\n'
printf 'Attempted:%s\n' "$attempted"
printf 'Succeeded:%s\n' "$succeeded"
printf 'Remaining ready unfailed tickets:\n'
bd -C "$launcher" ready -t implementation --exclude-label implementation-failed
