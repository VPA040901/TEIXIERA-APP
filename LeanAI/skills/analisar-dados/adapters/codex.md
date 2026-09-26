---

## Leitura de arquivos neste runtime

Codex traz plugins de documento habilitados por padrão. Use-os em vez de escrever parser:

- `.xlsx` / `.xls` → plugin `spreadsheets`
- `.pdf` → plugin `pdf`
- `.docx` → plugin `documents`
- `.csv`, `.json`, `.txt` → leitura direta

Se o plugin não estiver disponível na instalação, cair para leitura via script Node no
próprio workspace, e avisar o usuário que o plugin daria um resultado melhor.
