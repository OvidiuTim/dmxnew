"""Exercise server orchestration without accessing services, Git remotes or a DB."""
import os
from pathlib import Path
import shutil
import subprocess
import sys
from tempfile import TemporaryDirectory
import unittest


SCRIPT = Path(__file__).resolve().parents[1] / "updatesalary.sh"
STUB = r'''
import os, pathlib, sys
name = pathlib.Path(sys.argv[0]).name
args = sys.argv[1:]
with open(os.environ["CALL_LOG"], "a") as log:
    log.write(name + " " + " ".join(args) + "\n")
if name == "sudo":
    if args[:1] == ["-u"]:
        args = args[2:]
    if args[:1] == ["-H"]:
        args = args[1:]
    os.execvp(args[0], args)
elif name == "id":
    print("0")
elif name == "realpath":
    print(os.path.abspath(args[-1]))
elif name == "git":
    if args[:1] == ["status"] and os.environ.get("DIRTY"):
        print(" M tracked.py")
    elif args[:1] == ["branch"]:
        print("main")
    elif args[:1] == ["rev-parse"]:
        print("abc123")
    elif args[:1] == ["pull"]:
        print("Already up to date.")
elif name == "pg_dump":
    print("backup-data")
elif name == "curl":
    print("401", end="")
elif name == "python":
    if "import_employee_salaries" in args and os.environ.get("FAIL_IMPORT"):
        sys.exit(7)
'''


class UpdateSalaryScriptTests(unittest.TestCase):
    def run_script(self, **extra_env):
        with TemporaryDirectory() as directory:
            root = Path(directory)
            repo = root / "repo"
            app = repo / "Inventory-and-bill-proccesor-main/dataAPI"
            (repo / ".git").mkdir(parents=True)
            (app / ".venv/bin").mkdir(parents=True)
            (app / "ToolApp/data").mkdir(parents=True)
            (app / ".env").write_text("test only")
            (app / "ToolApp/data/Salarii_iulie_lichidare.xlsx").write_text("fixture")
            commands = root / "bin"
            commands.mkdir()
            for name in ("id", "sudo", "realpath", "git", "flock", "pg_dump", "pg_restore", "systemctl", "curl"):
                stub = commands / name
                stub.write_text(f"#!{sys.executable}\n" + STUB)
                stub.chmod(0o755)
            python = app / ".venv/bin/python"
            python.write_text(f"#!{sys.executable}\n" + STUB)
            python.chmod(0o755)
            executable = root / "temporary-script.sh"
            shutil.copyfile(SCRIPT, executable)
            log = root / "calls.log"
            env = dict(os.environ, PATH=f"{commands}:{os.environ['PATH']}",
                       REPO_DIR=str(repo), SALARY_RELOCATED="1", CALL_LOG=str(log),
                       SALARY_LOCK_FILE=str(root / "lock"), **extra_env)
            result = subprocess.run(["bash", str(executable)], env=env, text=True,
                                    stdout=subprocess.PIPE, stderr=subprocess.STDOUT, timeout=30)
            return result, log.read_text(), list((repo / "backups").glob("*/pontaj.dump"))

    def test_up_to_date_git_still_imports_and_restarts_backend(self):
        result, calls, backups = self.run_script()
        self.assertEqual(result.returncode, 0, result.stdout)
        self.assertEqual(len(backups), 1)
        self.assertIn("git pull --ff-only origin main", calls)
        self.assertIn("--require-matches --apply", calls)
        self.assertLess(calls.index("pg_dump "), calls.index("git pull "))
        self.assertLess(calls.index("systemctl stop pontaj"), calls.index("python manage.py migrate"))
        self.assertLess(calls.index("--require-matches --apply"), calls.index("systemctl start pontaj"))
        self.assertIn("systemctl start cron", calls)
        self.assertIn("curl --connect-timeout 5 --max-time 15 -sS -X POST", calls)

    def test_failed_import_restarts_stopped_services_and_reports_failure(self):
        result, calls, _ = self.run_script(FAIL_IMPORT="1")
        self.assertEqual(result.returncode, 7, result.stdout)
        self.assertIn("systemctl start pontaj", calls)
        self.assertIn("systemctl start cron", calls)
        self.assertNotIn("SALARII ACTUALIZATE", result.stdout)

    def test_dirty_repository_is_not_overwritten(self):
        result, calls, backups = self.run_script(DIRTY="1")
        self.assertNotEqual(result.returncode, 0)
        self.assertNotIn("git pull", calls)
        self.assertNotIn("systemctl stop", calls)
        self.assertEqual(backups, [])


if __name__ == "__main__":
    unittest.main()
