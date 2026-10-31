# AUR: lost-and-prompt-bin

Paquete binario para Arch Linux y derivadas, construido a partir del `.deb` de cada release.
El flujo `.github/workflows/aur.yml` lo construye, lo instala y comprueba `.SRCINFO` en un
contenedor de Arch.

Publicar o actualizar (requiere cuenta en aur.archlinux.org con la clave `~/.ssh/aur`): `scripts/publish-aur.sh`, o a mano:

```bash
git clone ssh://aur@aur.archlinux.org/lost-and-prompt-bin.git /tmp/aur-lap
cp packaging/aur/PKGBUILD packaging/aur/.SRCINFO /tmp/aur-lap/
cd /tmp/aur-lap && git add -A && git commit -m "Update to <versión>" && git push
```

En cada versión nueva: cambiar `pkgver`, las dos sumas `sha256sums` y las mismas líneas de `.SRCINFO`.
