# English Tracker

Site estático para acompanhar o tempo de estudo de inglês.

## Funcionalidades

- **Cronômetro**: começa parado e conta a partir do clique em *Iniciar*. Dá para pausar/retomar, e ao clicar em *Parar e salvar* você informa o nome da atividade. Se fechar a aba, o cronômetro continua de onde parou ao reabrir.
- **Lançar período**: registra atividades passadas informando nome, data, horário (opcional) e duração.
- **Dashboard**: tempo estudado hoje, na semana (seg–dom), no mês, no ano e total, gráfico dos últimos 14 dias e ranking por atividade.
- **Histórico**: lista de sessões agrupadas por dia, com exclusão e exportação/importação em JSON (backup).

## Instalar no iPhone (PWA)

1. Abra o site no **Safari**.
2. Toque em **Compartilhar** (o quadrado com a seta) e depois em **Adicionar à Tela de Início**.
3. O app aparece com ícone próprio e abre em tela cheia. Se o iPhone suspender o app em segundo plano, o tempo continua
   certo: ao voltar, o cronômetro recalcula a partir da hora de início.

## Onde ficam os dados

- **Sem AWS** (`js/config.js` vazio): tudo fica no `localStorage` do navegador.
- **Com AWS**: login pelo Cognito e as sessões vão para o DynamoDB, através de API Gateway e Lambda. O template está em
  `infra/template.yaml` e o passo a passo em [docs/AWS.md](docs/AWS.md). O estado do cronômetro em andamento continua
  sendo local, em cada dispositivo.

## Rodar localmente

```bash
python3 -m http.server 8000
# abrir http://localhost:8000
```

## Publicar no GitHub Pages

1. Crie um repositório no GitHub e envie estes arquivos para a branch `main`.
2. Em **Settings → Pages**, selecione *Deploy from a branch*, branch `main`, pasta `/ (root)`.
3. O site ficará em `https://<seu-usuario>.github.io/<repositorio>/`.
