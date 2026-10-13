# Configurando a AWS (passo a passo para iniciantes)

Você vai criar, com **um único comando**, toda a estrutura na AWS:

| Serviço | Para quê |
|---|---|
| **Cognito** | Login. Só existe o usuário que você criar; ninguém consegue se cadastrar sozinho. |
| **API Gateway + Lambda** | A API que o site chama para ler, salvar e excluir sessões. Só aceita quem está logado. |
| **DynamoDB** | O banco de dados onde as sessões ficam guardadas (com backup contínuo ligado). |

Tudo está descrito no arquivo `infra/template.yaml` (CloudFormation). Para um uso pessoal, o custo deve ficar
dentro do nível gratuito (free tier), na prática centavos por mês, no máximo.

---

## 1. Abrir o console da AWS na região certa

1. Entre em https://console.aws.amazon.com/
2. No canto superior direito, ao lado do seu nome, escolha a região **América do Sul (São Paulo) `sa-east-1`**.

## 2. Abrir o CloudShell

1. Na barra superior do console, clique no ícone **`>_`** (CloudShell), ou procure "CloudShell" na busca.
2. Espere o terminal carregar (na primeira vez demora cerca de 1 minuto).

> Todos os comandos abaixo são para **copiar e colar no CloudShell**, um bloco de cada vez.

## 3. Baixar o template

```bash
curl -fsSLO https://raw.githubusercontent.com/laudisio/english-tracker/main/infra/template.yaml && ls -l template.yaml
```

Deve aparecer uma linha com `template.yaml`.

> Se der erro 404 (repositório privado): baixe o arquivo `infra/template.yaml` pelo GitHub no seu PC e, no CloudShell,
> clique em **Actions → Upload file** e escolha o arquivo. Depois rode `sed -i 's/\r$//' template.yaml`.

## 4. Criar a estrutura (leva de 1 a 3 minutos)

```bash
aws cloudformation deploy \
  --stack-name english-tracker \
  --template-file template.yaml \
  --capabilities CAPABILITY_IAM
```

No final deve aparecer `Successfully created/updated stack - english-tracker`.

## 5. Criar o seu usuário de login

Troque `seu-email@exemplo.com` pelo seu e-mail e cole:

```bash
EMAIL="seu-email@exemplo.com"
POOL_ID=$(aws cloudformation describe-stacks --stack-name english-tracker \
  --query "Stacks[0].Outputs[?OutputKey=='UserPoolId'].OutputValue" --output text)
aws cognito-idp admin-create-user --user-pool-id "$POOL_ID" --username "$EMAIL" \
  --user-attributes Name=email,Value="$EMAIL" Name=email_verified,Value=true \
  --message-action SUPPRESS > /dev/null && echo "Usuário criado"
```

Agora defina a senha. Ela precisa ter **no mínimo 10 caracteres, com letra maiúscula, letra minúscula e número**.
O comando abaixo pede a senha sem mostrar o que você digita:

```bash
read -s -p "Digite a senha: " SENHA; echo
aws cognito-idp admin-set-user-password --user-pool-id "$POOL_ID" --username "$EMAIL" \
  --password "$SENHA" --permanent && echo "Senha definida"
unset SENHA
```

## 6. Pegar a configuração do site

```bash
aws cloudformation describe-stacks --stack-name english-tracker \
  --query "Stacks[0].Outputs[?OutputKey=='ConfigJs'].OutputValue" --output text
```

Vai aparecer uma linha parecida com:

```js
export const config = { region: "sa-east-1", userPoolClientId: "abc123...", apiUrl: "https://xxxx.execute-api.sa-east-1.amazonaws.com" };
```

Esses valores **não são segredos** (qualquer site com login expõe esses dados). Você pode:

- **Mandar essa linha para o Devin**, que atualiza o site; ou
- Editar você mesmo: abra https://github.com/laudisio/english-tracker/edit/main/js/config.js, troque a última linha
  pela linha acima e clique em **Commit changes**.

## 7. Testar

1. Abra https://laudisio.github.io/english-tracker/ (pode levar 1 minuto para o GitHub Pages atualizar).
2. Vai aparecer a tela de **Entrar**. Use o e-mail e a senha do passo 5.
3. Se você já tinha sessões salvas no navegador, o site pergunta se quer enviá-las para a nuvem. Responda **OK**.

Pronto: agora os dados ficam na AWS e aparecem em qualquer computador ou celular em que você fizer login.

---

## Perguntas comuns

**Esqueci a senha.** Repita o bloco da senha do passo 5. Antes, rode a primeira linha do passo 5 com seu e-mail e a
linha do `POOL_ID`.

**Quero atualizar a estrutura depois de uma mudança no template.** Repita os passos 3 e 4. Antes do passo 3, rode
`rm -f template.yaml` (o CloudShell não sobrescreve arquivos com o mesmo nome no upload).

**Quero apagar tudo.** Rode `aws cloudformation delete-stack --stack-name english-tracker`. Por segurança, o banco de
dados (DynamoDB) e o cadastro de usuários (Cognito) **não** são apagados junto. Para apagá-los, exclua manualmente no
console do DynamoDB e do Cognito.

**Usar o site em outro endereço** (ex.: domínio próprio): no passo 4, acrescente
`--parameter-overrides AllowedOrigin=https://seu-dominio.com`.
