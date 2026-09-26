# Queimadabol

Primeira versão do jogo de queimada presencial com interface de RPG para celular. Sem conta e sem backend próprio: crie uma sala, compartilhe o código, escolha uma classe e jogue.

## Rodar localmente

`npm install` e `npm run dev`. Para validar: `npm run build` e `npm run lint`.

## Publicar no GitHub Pages

Envie este projeto a um repositório GitHub. Em **Settings → Pages → Build and deployment**, escolha **GitHub Actions**. O workflow `.github/workflows/deploy.yml` publica a pasta `dist` a cada push na branch `main` (ou `master`). O `base: './'` do Vite permite publicar em repositórios com subcaminho.

## Como jogar

- O anfitrião cria a sala e precisa manter a aba aberta. Todos os demais entram com o código; pelo menos duas pessoas devem marcar **Estou pronto** para começar o round de 15 minutos.
- Só aperte **Atacar** com a bola e a chance real de arremessar. O ataque preparado substitui o anterior; não é preciso selecionar o alvo. Ao ser atingido, aperte **Take Damage** e selecione quem arremessou. Um mesmo ataque não pode ser registrado duas vezes pela mesma pessoa.
- O suporte cura em vez de causar dano quando selecionado. O DPS pode aplicar veneno; o suporte pode aplicar paixão a uma pessoa de cada vez, impedindo essa pessoa de atacar o suporte enquanto o efeito estiver ativo.
- Marque **Super ataque** antes de atacar e desenhe a forma da sua classe. O super amplifica dano ou cura e tem usos limitados por round.
- Ao zerar vida, o jogador fica fora até o próximo round. O eliminador ganha XP adicional proporcional ao XP da vítima, mas ninguém perde XP ao morrer.
- No intervalo, a loja é apenas visual: **nenhum upgrade é comprado ou gasta XP nesta versão**. Todos marcam pronto novamente para começar o round seguinte.

## Arquivos para evoluir

- `src/game.ts`: `RULES`, `CLASSES`, atributos por jogador, efeitos e transições. Adicione a lógica dos upgrades aqui e exponha novas ações na união `Action`.
- `src/App.tsx`: interface e espaços visuais da loja; conecte aqui a compra de upgrades.
- `src/gesture.ts`: desenhos reconhecidos para cada classe.
- `src/network.ts`: sincronização P2P via PeerJS; o anfitrião controla o estado e o relógio.

## Limitações da primeira parte

PeerJS usa servidor público **apenas para sinalização WebRTC**; dados de jogo via conexão P2P quando possível (STUN/TURN podem ser necessários em redes restritivas). É necessária internet, e algumas redes móveis/NATs podem impedir conexão direta. Não há persistência: recarregar, fechar a aba ou perder o anfitrião encerra a sessão/identidade e XP. A sala não possui autenticação nem proteção contra clientes modificados: a proposta é jogar com confiança e autoimposição das regras, não competição à prova de trapaça. Mantenha o celular acordado para o relógio e o veneno avançarem no navegador do anfitrião.
