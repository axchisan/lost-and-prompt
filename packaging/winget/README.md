# winget

Manifiestos de `axchisan.LostAndPrompt` para [microsoft/winget-pkgs](https://github.com/microsoft/winget-pkgs).

Enviar una versión (abre un pull request desde tu cuenta con [Komac](https://github.com/russellbanks/Komac)):

```bash
brew install komac
GITHUB_TOKEN=$(gh auth token) komac submit packaging/winget/manifests/a/axchisan/LostAndPrompt/<versión> --yes
```

Versiones siguientes, a partir de la última aprobada:

```bash
GITHUB_TOKEN=$(gh auth token) komac update axchisan.LostAndPrompt --version <versión> \
  --urls https://github.com/axchisan/lost-and-prompt/releases/download/v<versión>/LostAndPrompt-<versión>-windows-x64-setup.exe --submit
```

El bot de validación de Microsoft instala el paquete en una máquina virtual y un moderador lo
revisa; la primera vez suele tardar unos días.
