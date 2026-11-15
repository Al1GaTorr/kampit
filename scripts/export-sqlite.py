"""Export an authorized, offline D1 SQLite snapshot to canonical JSON. No network."""
import argparse, hashlib, json, os, sqlite3
from pathlib import Path
parser=argparse.ArgumentParser()
parser.add_argument('database',help='Local SQLite snapshot (restore the authorized D1 SQL export first)')
parser.add_argument('output',help='Sensitive JSON file: keep outside source control')
args=parser.parse_args()
tables=['profiles','demo_sessions','seasons','goals','template_locks','competitions','competition_members','daily_checkins','score_events','rank_records','rank_history']
conn=sqlite3.connect(Path(args.database).resolve().as_uri()+'?mode=ro',uri=True)
conn.row_factory=sqlite3.Row
data={name:[dict(row) for row in conn.execute('SELECT * FROM "'+name+'"')] for name in tables}
payload={'format':'kampit-legacy-export-v1','tables':data}
encoded=json.dumps(payload,ensure_ascii=False,separators=(',',':')).encode()
fd=os.open(args.output,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
with os.fdopen(fd,'wb') as handle: handle.write(encoded)
print(json.dumps({'counts':{k:len(v) for k,v in data.items()},'sha256':hashlib.sha256(encoded).hexdigest()}))
