This folder holds one JSON file per blog post, written by the Blog collection
in static/admin/config.yml. It ships empty, and an empty folder is not a
state git can record — so this file is here to keep the folder in the
repository, and for no other reason. It is not read by anything: the glob in
src/lib/content/index.ts and the checks in scripts/ all look at *.json only.
