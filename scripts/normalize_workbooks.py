"""Normalize namespace serialization for the existing ExcelJS importer."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED

root = Path(__file__).resolve().parents[1]
for period in ('before', 'after'):
    target = root / f'company_{period}' / 'Оргструктура компании.xlsx'
    with ZipFile(target) as original:
        entries = [(item.filename, original.read(item.filename)) for item in original.infolist()]
    with ZipFile(target, 'w', ZIP_DEFLATED) as output:
        for name, data in entries:
            if name.startswith('xl/') and name.endswith('.xml'):
                data = data.replace(b'<x:', b'<').replace(b'</x:', b'</').replace(b'xmlns:x="http://schemas.openxmlformats.org/spreadsheetml/2006/main"', b'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"')
            output.writestr(name, data)