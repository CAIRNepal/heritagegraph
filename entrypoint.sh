#!/usr/bin/env bash

set -eu

fail() {
    printf >&2 "%s: %s\n" "$0" "$1"
    exit 1
}

cmd_bash() {
    exec bash "$@"
}

cmd_init() {
    # Run migrations for SQLite
    ~/manage.py migrate

    # Collect static files
    ~/manage.py collectstatic --no-input
}

cmd_run() {
    if [ "$#" -eq 0 ]; then
        fail "run: at least 1 argument is expected"
    fi

    component="$1"

    if [ "$component" != "server" ]; then
        fail "run: only 'server' component is supported in this simple setup"
    fi

    echo "Running migrations (if any)..."
    ~/manage.py migrate

    echo "Collecting static files..."
    ~/manage.py collectstatic --no-input

    echo "Starting supervisord with server config (runs Django + nginx)..."
    exec supervisord -c "supervisord/$component.conf"
}

if [ $# -eq 0 ]; then
    echo >&2 "$0: at least one subcommand required"
    echo >&2 ""
    echo >&2 "available subcommands:"
    echo >&2 "    bash <bash args...>"
    echo >&2 "    init"
    echo >&2 "    run server"
    exit 1
fi

while [ $# -ne 0 ]; do
    if [ "$(type -t "cmd_$1")" != "function" ]; then
        fail "unknown subcommand: $1"
    fi

    cmd_name="$1"
    shift
    "cmd_$cmd_name" "$@"
done
