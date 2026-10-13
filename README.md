# English Tracker

Site estático para acompanhar o tempo de estudo de inglês.

## Funcionalidades

- **Cronômetro**: começa a contar assim que o site é aberto. Dá para pausar/retomar, e ao clicar em *Parar e salvar* você informa o nome da atividade. Se fechar a aba, o cronômetro continua de onde parou ao reabrir.
- **Lançar período**: registra atividades passadas informando nome, data, horário (opcional) e duração.
- **Dashboard**: tempo estudado hoje, na semana (seg–dom), no mês, no ano e total, gráfico dos últimos 14 dias e ranking por atividade.
- **Histórico**: lista de sessões agrupadas por dia, com exclusão e exportação/importação em JSON (backup).

Os dados ficam no `localStorage` do navegador (veja `js/storage.js`). A camada de armazenamento é isolada para depois ser trocada por uma API na AWS.

## Rodar localmente

```bash
python3 -m http.server 8000
# abrir http://localhost:8000
```

## Publicar no GitHub Pages

1. Crie um repositório no GitHub e envie estes arquivos para a branch `main`.
2. Em **Settings → Pages**, selecione *Deploy from a branch*, branch `main`, pasta `/ (root)`.
3. O site ficará em `https://<seu-usuario>.github.io/<repositorio>/`.
