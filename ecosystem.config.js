module.exports = {
  apps: [
    {
      name: 'naturabelas',
      script: 'npm',
      args: 'start',
      cwd: '/home/admin/naturabelas',
      exec_mode: 'fork',
      instances: 1,
      watch: false,
      autorestart: true,
      // Não mata a árvore de processos inteira ao reiniciar — sem isso, o PM2
      // matava o ffmpeg no meio de uma conversão de áudio em qualquer restart,
      // derrubando envios de mensagem de voz em andamento (bug real corrigido
      // em 21/07/2026). Depende do "exec" no script "start" do package.json
      // pra funcionar (sem o exec, o next-server nunca recebe o sinal do PM2).
      treekill: false,
      // Dá até 30s pra terminar o que estava em andamento antes de forçar o
      // encerramento — só afeta o raro restart que cai bem no meio de um envio
      // de áudio; os demais continuam rápidos como sempre.
      kill_timeout: 30000,
    },
  ],
}
