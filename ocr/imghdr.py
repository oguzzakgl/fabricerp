# Imghdr module compatibility shim for Python 3.13+
__all__ = ["what"]

def what(file, h=None):
    if h is None:
        if isinstance(file, (str, bytes)):
            with open(file, 'rb') as f:
                h = f.read(32)
        else:
            location = file.tell()
            h = file.read(32)
            file.seek(location)
    
    for tf in tests:
        res = tf(h, file)
        if res:
            return res
    return None

tests = []

def test_jpeg(h, f):
    if h[6:10] in (b'JFIF', b'Exif'):
        return 'jpeg'
    return None
tests.append(test_jpeg)

def test_png(h, f):
    if h.startswith(b'\211PNG\r\n\032\n'):
        return 'png'
    return None
tests.append(test_png)

def test_gif(h, f):
    if h[:6] in (b'GIF87a', b'GIF89a'):
        return 'gif'
    return None
tests.append(test_gif)

def test_tiff(h, f):
    if h[:2] in (b'MM', b'II'):
        return 'tiff'
    return None
tests.append(test_tiff)

def test_rgb(h, f):
    if h.startswith(b'\001\332'):
        return 'rgb'
    return None
tests.append(test_rgb)

def test_pbm(h, f):
    if len(h) >= 3 and h[0] == ord('P') and h[1] in (ord('1'), ord('4')) and h[2] in b' \t\n\r':
        return 'pbm'
    return None
tests.append(test_pbm)

def test_pgm(h, f):
    if len(h) >= 3 and h[0] == ord('P') and h[1] in (ord('2'), ord('5')) and h[2] in b' \t\n\r':
        return 'pgm'
    return None
tests.append(test_pgm)

def test_ppm(h, f):
    if len(h) >= 3 and h[0] == ord('P') and h[1] in (ord('3'), ord('6')) and h[2] in b' \t\n\r':
        return 'ppm'
    return None
tests.append(test_ppm)

def test_rast(h, f):
    if h.startswith(b'\x59\xA6\x6A\x95'):
        return 'rast'
    return None
tests.append(test_rast)

def test_xbm(h, f):
    if h.startswith(b'#define '):
        return 'xbm'
    return None
tests.append(test_xbm)

def test_bmp(h, f):
    if h.startswith(b'BM'):
        return 'bmp'
    return None
tests.append(test_bmp)

def test_webp(h, f):
    if h.startswith(b'RIFF') and h[8:12] == b'WEBP':
        return 'webp'
    return None
tests.append(test_webp)

def test_exr(h, f):
    if h.startswith(b'\x76\x2f\x31\x01'):
        return 'exr'
    return None
tests.append(test_exr)
