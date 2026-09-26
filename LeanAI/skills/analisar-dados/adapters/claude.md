---

## Leitura de arquivos neste runtime

Claude Code traz skills nativas para formatos de escritório. Use-as em vez de escrever
parser:

- `.xlsx` / `.xls` → skill `xlsx`
- `.pdf` → skill `pdf`
- `.docx` → skill `docx`
- `.csv`, `.json`, `.txt` → leitura direta

Se o arquivo for grande demais para ler inteiro, ler em blocos e agregar antes de analisar.
