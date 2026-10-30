"""Private recovery only: no tar links, devices, traversal, overwrite or bomb."""
import os
import pathlib
import sys
import tarfile

archive, destination = sys.argv[1:]
root = pathlib.Path(destination)
# Validate the complete member list before writing any payload.
with tarfile.open(archive, 'r:gz') as tar:
    members = tar.getmembers()
    seen = set()
    total = 0
    if len(members) > 512:
        raise ValueError('unsafe archive count')
    for member in members:
        path = pathlib.PurePosixPath(member.name)
        if (path.is_absolute() or '..' in path.parts or not path.parts
                or path.parts[0] not in ('raw-source.json', 'saturday-run')
                or member.name in seen or not (member.isfile() or member.isdir())
                or member.size < 0 or member.size > 64 * 1024 * 1024):
            raise ValueError('unsafe archive member')
        seen.add(member.name)
        total += member.size
    if total > 250 * 1024 * 1024:
        raise ValueError('unsafe archive size')
    for member in members:
        target = root.joinpath(*pathlib.PurePosixPath(member.name).parts)
        target.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
        if member.isdir():
            target.mkdir(exist_ok=True, mode=0o700)
        else:
            # Fresh directory, exclusive files, no archived modes/owners applied.
            with os.fdopen(os.open(target, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600), 'wb') as out:
                with tar.extractfile(member) as source:
                    while chunk := source.read(1024 * 1024):
                        out.write(chunk)
