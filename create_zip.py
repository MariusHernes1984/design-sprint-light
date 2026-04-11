import zipfile, os

zipname = 'deploy.zip'
if os.path.exists(zipname):
    os.remove(zipname)

with zipfile.ZipFile(zipname, 'w', zipfile.ZIP_DEFLATED) as zf:
    # dist/
    for root, dirs, files in os.walk('dist'):
        for f in files:
            fp = os.path.join(root, f)
            arcname = fp.replace(os.sep, '/')
            zf.write(fp, arcname)

    # prisma/
    for root, dirs, files in os.walk('prisma'):
        for f in files:
            fp = os.path.join(root, f)
            arcname = fp.replace(os.sep, '/')
            zf.write(fp, arcname)

    # node_modules/.prisma/ and node_modules/@prisma/
    for prefix in ['node_modules/.prisma', 'node_modules/@prisma']:
        if not os.path.exists(prefix):
            continue
        for root, dirs, files in os.walk(prefix):
            for f in files:
                fp = os.path.join(root, f)
                arcname = fp.replace(os.sep, '/')
                zf.write(fp, arcname)

    # package.json
    zf.write('package.json', 'package.json')

print('deploy.zip created')
with zipfile.ZipFile(zipname, 'r') as zf:
    names = zf.namelist()
    print(f'Total entries: {len(names)}')
    for n in names[:20]:
        print(f'  {n}')
    print('  ...')
