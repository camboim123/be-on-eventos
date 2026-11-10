# Como atualizar o site BE·ON PASS

O site é publicado pelo GitHub Pages em https://camboim123.github.io/be-on-eventos/

## Onde fica cada coisa

| Arquivo | O que tem |
|---|---|
| `index.html` | Conteúdo da página **e a lista de eventos** (bloco `<script id="beon-data">`) |
| `css/estilo.css` | Cores, fontes e layout |
| `js/site.js` | Relógio, contagem regressiva, busca, favoritos, copiar cupom, compartilhar |
| `img/` | Artes dos eventos (formato `.webp`) e a imagem de compartilhamento `og-cupom.jpg` |
| `ferramentas/atualizar-site.js` | Script que gera os cards, o "Próximo evento", os dados para o Google e o sitemap a partir da lista de eventos |

## Adicionar um evento novo

1. Coloque a arte na pasta `img/`, de preferência em `.webp` e com até 800 px de altura.
2. No `index.html`, procure `"events": [` dentro do bloco `beon-data` e copie um evento existente. Ajuste:
   - `id`: um nome curto sem espaços, por exemplo `"tomorrowland-sp"`
   - `title`, `short`, `tag`, `desc` e `performers` (a lista de artistas)
   - `date` (`AAAA-MM-DD`), e se souber `time` (`HH:MM`), `end` (`AAAA-MM-DDTHH:MM`) e `horario` (por exemplo `"23h às 7h"`)
   - `venue` (local), `city` e `state`
   - `img`, `imgW` e `imgH` (largura e altura da arte em pixels) e `alt` (descrição da arte)
   - `buyHref`: o link da Ingresse **já com o cupom** (`?coupon=THIAGOCAMBOIM` ou `?passkey=THIAGOCAMBOIM`)
   - `soldout`: `true` quando esgotar
3. Rode na pasta do projeto:

   ```bash
   node ferramentas/atualizar-site.js
   ```

   Ele refaz os cards, o "Próximo evento", os dados para o Google e o sitemap. Os eventos que já passaram vão sozinhos para a aba "Eventos anteriores". **Não apague o evento da lista:** é assim que ele aparece lá.
4. Faça o commit e envie para o GitHub (push).

Você também pode simplesmente pedir ao Claude: *"adiciona o evento X, dia tal, local tal, link tal"*.

## Estatísticas de acesso (GoatCounter)

O site conta visitas e cliques (comprar, WhatsApp, compartilhar, agenda, favoritar, copiar cupom) pelo GoatCounter, sem cookies.
A contagem só funciona com o código do site preenchido em `"goatcounter"`, dentro do `beon-data` (por exemplo `"beon-thiago"`). Com o campo vazio, nada é contado.
Os números aparecem no painel local, na pasta `C:\Users\55119\Projetos\be-on-painel`, que fica fora deste repositório. Veja o `LEIA-ME.md` de lá.

## Assistente be-onzinho

No Claude Code, aberto nesta pasta, existe o agente **be-onzinho** (`.claude/agents/be-onzinho.md`). Ele já conhece o projeto. Peça, por exemplo, *"be-onzinho, adiciona o evento tal"*.

## Coisas que funcionam sozinhas

- Quando um evento termina, ele sai de "Próximos eventos" e vai para a aba **"Eventos anteriores"**, sem botão de compra e com o selo "Evento realizado". Sem horário de fim, ele vale até as 6h do dia seguinte. O link direto para a aba é `.../be-on-eventos/#anteriores`.
- O bloco "Próximo evento" sempre mostra o evento mais próximo que ainda tem ingresso à venda.
- A contagem regressiva fica em destaque quando faltam 7 dias ou menos.
- Ao clicar em "Comprar ingresso", o cupom também é copiado, para colar no checkout se a Ingresse pedir.
