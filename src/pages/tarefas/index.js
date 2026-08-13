// Next
import Head from "next/head";
import { useRouter } from 'next/router';
import { DragDropProvider } from "@dnd-kit/react";
import { move } from '@dnd-kit/helpers';
import { useSortable } from '@dnd-kit/react/sortable';
import { CollisionPriority } from '@dnd-kit/abstract';

// MUI
import Stack from "@mui/material/Stack";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import IconButton from '@mui/material/IconButton';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Tooltip from '@mui/material/Tooltip';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import { alpha } from '@mui/material/styles';

// React
import { useEffect, useState, useMemo, useCallback, memo, useRef } from 'react';
import { io } from 'socket.io-client';
import { toast } from 'react-toastify';

// UI Personalizado
import Loading from '@/components/common/Loading';
import ModalCloseButton from '@/components/common/ModalCloseButton';
import TarefaFormulario from "../../components/tarefas/TarefaFormulario";
import ColunaFormulario from "../../components/tarefas/ColunaFormulario";

// Utils
import authAxios from "@/utils/authAxios";
import catchAuthAxios from '@/utils/catchAxios';
import { getToken } from '@/utils/token';
import columnType from "@/utils/columnType";
import capitalizeFirstLetter from "@/utils/capitalizeFirstLetter";
import { formatDate } from "@/utils/formatDate";
import ProfilePicture from "@/components/common/ProfilePicture";
import TaskPriorityIcon from '@/components/tarefas/TaskPriorityIcon';
import { getTaskPriority } from '@/utils/taskPriority';
import { getBottomNavigationActionUtilityClass } from "@mui/material/BottomNavigationAction";

const hoverOpacity = 0.5;

// O join faz consulta no banco antes de confirmar; a margem cobre isso sem
// deixar o usuário sem resposta caso o socket caia antes do ack voltar.
const JOIN_TIMEOUT_MS = 5000;

const scrollbarSx = {
  scrollbarWidth: 'thin',
  scrollbarColor: (theme) => `${alpha(theme.palette.text.primary, 0.32)} transparent`,
  '&::-webkit-scrollbar': {
    width: 8,
    height: 8,
  },
  '&::-webkit-scrollbar-track': {
    backgroundColor: 'transparent',
  },
  '&::-webkit-scrollbar-thumb': {
    backgroundColor: (theme) => alpha(theme.palette.text.primary, 0.32),
    border: '2px solid transparent',
    borderRadius: 999,
    backgroundClip: 'content-box',
  },
  '&::-webkit-scrollbar-thumb:hover': {
    backgroundColor: (theme) => alpha(theme.palette.text.primary, 0.52),
  },
};

const setTarefaId = (id) => {
  return `tarefa-${id}`;
}

const getTarefaId = (id) => {
  return typeof id === 'number' ? id : Number(id.split('-').pop());
}

const colunaBoxProps = (coluna, isDropTarget, isDragging) => ({
  size: { xs: 12, sm: 6, md: 2 },
  sx: {
    minWidth: '250px',
    maxWidth: '250px',
    overflow: 'hidden',
    position: 'relative',
    mb: 3,
    px: 1,
    pb: 1,
    borderTop: 4,
    borderColor: `${columnType[coluna.tipo] ?? 'default'}.main`,
    borderRadius: 2,
    bgcolor: (theme) => theme.palette.mode === 'dark'
      ? alpha(theme.palette.common.white, 0.12)
      : theme.palette.background.paper,
    opacity: isDropTarget || isDragging ? hoverOpacity : 1,
  }
});

const tarefaCardProps = (tarefa, isDragging) => ({
  elevation: 4,
  sx: {
    cursor: "pointer",
    opacity: isDragging ? hoverOpacity : 1,
    transition: "transform 0.2s ease, box-shadow 0.2s ease",
    "&:hover": {
      transform: "translateY(-4px)",
      boxShadow: 8,
    },
  }
});

const Coluna = memo(({ children, id, index, coluna, qtdTarefas, handleOpenMenu, writePermission }) => {

  const { ref, isDragging, isDropTarget, handleRef } = useSortable({
    id,
    index,
    type: 'coluna',
    collisionPriority: CollisionPriority.Low,
    accept: ['tarefa', 'coluna'],
    disabled: writePermission === false
  });

  return (
    <Box ref={ref} {...colunaBoxProps(coluna, isDropTarget, isDragging)} >
      {/* Header */}
      <Stack
        direction='row'
        justifyContent='space-between'
        alignItems='center'
      >
        <Tooltip title={`${coluna.id} - ${capitalizeFirstLetter(coluna.nome)}`} sx={{ cursor: 'grab' }} ref={handleRef} >
          <Stack direction='row' justifyContent='flex-start' alignItems='center' data-board-pan-ignore="true">
            <DragIndicatorIcon />
            <Typography variant="h6" >
              {capitalizeFirstLetter(coluna.nome)}
            </Typography>
          </Stack>
        </Tooltip>
        <Stack direction='row' spacing={0.1} alignItems='center' >
          <Tooltip title={`Esta coluna tem ${qtdTarefas} tarefas`}>
            <IconButton size='small'>
              {qtdTarefas ?? '?'}
            </IconButton>
          </Tooltip>
          <Tooltip title='Ações da coluna'>
            <span>
              <IconButton size='small' onClick={(e) => handleOpenMenu(e, coluna)} disabled={writePermission === false}>
                <MoreVertIcon />
              </IconButton>
            </span>
          </Tooltip>
        </Stack>
      </Stack>
      {/* Tarefas */}
      <Stack
        direction='column'
        spacing={1}
        sx={{
          maxHeight: 'calc(100vh - 200px)',
          overflowY: 'auto',
          pr: 0.5,
          ...scrollbarSx,
          '& > *': { flexShrink: 0 },
        }}
      >
        {children}
      </Stack>
    </Box>
  );

});

const TarefaCard = memo(({ id, espaco, index, tarefa, idColuna, handleEditarTarefa, writePermission }) => {

  const { ref, isDragging } = useSortable({
    id,
    index,
    type: 'tarefa',
    accept: 'tarefa',
    group: idColuna,
    disabled: writePermission === false
  });

  const priority = getTaskPriority(tarefa.prioridade);

  return (
    <Card ref={ref} {...tarefaCardProps(tarefa, isDragging)} data-dragging={isDragging} data-board-pan-ignore="true">
      <CardContent onClick={() => handleEditarTarefa(tarefa)} sx={{ p: 1, '&:last-child': { pb: 1 } }}>
        <Typography variant="h6" component="h2">{tarefa.titulo}</Typography>
        <Typography variant="caption" display="block" color="text.secondary">{tarefa.data_limite ? `Data limite: ${formatDate(tarefa.data_limite)}` : null}</Typography>
        <Stack direction='row' justifyContent='space-between' alignItems='center' spacing={1} >
          <Typography color='info'>{espaco.sigla}-{getTarefaId(tarefa.id)}</Typography>
          <Stack direction='row' alignItems='center' spacing={1}>
            <Tooltip title={`Prioridade: ${priority.label}`}>
              <span>
                <TaskPriorityIcon priority={priority.value} fontSize='small' />
              </span>
            </Tooltip>
            <ProfilePicture size='small' user={tarefa?.usuario} />
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
});

const fetchTarefas = async (id_espaco) => {
  try {
    const urlParams = new URLSearchParams({ id_espaco });
    const res = await authAxios('get', `/api/tarefas/listarTarefas?${urlParams.toString()}`);
    const tarefas = res.data.data;
    tarefas.forEach(tarefa => tarefa.id = setTarefaId(tarefa.id));
    return tarefas;
  } catch (error) {
    catchAuthAxios(error, 'Erro ao listar tarefas');
  }
};

// Buscar tarefas, colunas e usuários
const fetchColunas = async (id_espaco) => {
  try {
    const urlParams = new URLSearchParams({ id_espaco });
    const res = await authAxios('get', `/api/colunas/listarColunas?${urlParams.toString()}`);
    return res.data.data;
  } catch (error) {
    catchAuthAxios(error, 'Erro ao listar colunas');
  }
};

const fetchUsuarios = async (id_espaco) => {
  try {
    const urlParams = new URLSearchParams({ id_espaco });
    const res = await authAxios('get', `/api/espacos/listarUsuarios?${urlParams.toString()}`);
    return res.data.data;
  } catch (error) {
    catchAuthAxios(error, 'Erro ao listar colunas');
  }
};

export default function TarefasPage({ espaco, writePermission, tarefaIdInicial = null }) {

  const router = useRouter();

  // Dados
  const [espacoUsuarios, setEspacoUsuarios] = useState([]);
  const [tarefasPorColuna, setTarefasPorColuna] = useState({});
  const [colunas, setColunas] = useState([]);
  const [idColunas, setIdColunas] = useState([]);

  // Menus
  const [isLoading, setIsLoading] = useState(false);
  const [tarefaModal, setTarefaModal] = useState({ open: false, data: {} });
  const [colunaModal, setColunaModal] = useState({ open: false, data: {} });
  const [menu, setMenu] = useState({ anchorEl: null, coluna: null });
  const [isBoardPanning, setIsBoardPanning] = useState(false);

  const arrastandoTarefa = useRef(false);
  const precisaAtualizarTarefas = useRef(false);
  const arrastandoColuna = useRef(false);
  const precisaAtualizarColunas = useRef(false);
  const espacoUsuariosRef = useRef(espacoUsuarios);
  const tarefaAbertaPelaNavegacaoRef = useRef(null);
  const boardPanRef = useRef({ active: false, pointerId: null, startX: 0, scrollLeft: 0 });

  useEffect(() => {
    espacoUsuariosRef.current = espacoUsuarios;
  }, [espacoUsuarios]);

  useEffect(() => {
    const idEspaco = Number(espaco?.id);

    if (!Number.isInteger(idEspaco) || idEspaco <= 0) {
      return;
    }

    const socket = io({
      path: '/api/socketio',
      addTrailingSlash: false,
      auth: { token: getToken() },
      reconnectionAttempts: 5,
    });

    // Um join recusado não derruba a conexão: o quadro apenas para de receber
    // atualizações, sem nada na tela explicando por quê. O ack transforma esse
    // silêncio em aviso. Só avisa uma vez por montagem, senão cada tentativa de
    // reconexão repetiria o toast.
    let jaAvisouJoinRecusado = false;

    const avisarJoinRecusado = mensagem => {
      if (jaAvisouJoinRecusado) {
        return;
      }

      jaAvisouJoinRecusado = true;
      toast.error(mensagem);
    };

    const handleConnect = () => {
      socket
        .timeout(JOIN_TIMEOUT_MS)
        .emit('join_quadro', { id_espaco: idEspaco }, (erro, resposta) => {
          // `erro` aqui é estouro do timeout — inclui o caso de o socket cair
          // antes de o ack voltar.
          if (erro) {
            avisarJoinRecusado('Não foi possível sincronizar o quadro em tempo real. Recarregue a página.');
            return;
          }

          if (resposta?.ok === true) {
            return;
          }

          avisarJoinRecusado(
            resposta?.motivo === 'SEM_PERMISSAO'
              ? 'Você não tem acesso a este quadro. As atualizações em tempo real ficarão indisponíveis.'
              : 'Não foi possível sincronizar o quadro em tempo real. Recarregue a página.'
          );
        });
    };

    // O servidor marca falha de credencial com o código NAO_AUTORIZADO.
    // Sem essa distinção, uma oscilação de rede levaria o usuário ao login.
    const handleConnectError = error => {
      if (error?.data?.code !== 'NAO_AUTORIZADO') {
        return;
      }

      socket.disconnect();
      toast.error(error.message);
      router.push('/usuarios/login');
    };

    const handleTarefas = payload => {
      
      if (Number(payload?.id_espaco) !== idEspaco) {
        return;
      }

      if (payload.entity === 'coluna') {
        switch (payload.op) {
          case 'INSERT':
            setColunas(colunas => [...colunas, { ...payload.data }]);
            setIdColunas(idColunas => [...idColunas, payload.data.id]);
            setTarefasPorColuna(prev => ({ ...prev, [payload.data.id]: [] }));
            break;
          case 'UPDATE':
            setColunas(colunas => colunas.map(coluna => {
              if (coluna.id == payload.data.id) {
                return {
                  ...coluna,
                  ...payload.data,
                };
              }
              return coluna;
            }));

            if (payload.data.ativo === false) {
              setIdColunas(prev => prev.filter(idColuna => idColuna !== payload.data.id));
              setTarefasPorColuna(prev => {
                const map = { ...prev };
                delete map[payload.data.id];

                return map;
              });
            }
            break;
          case 'DELETE':
            setColunas(prev => prev.filter(coluna => coluna.id !== payload.data.id));
            setIdColunas(prev => prev.filter(idColuna => idColuna !== payload.data.id));
            setTarefasPorColuna(prev => {
              const map = { ...prev };
              delete map[payload.data.id];

              return map;
            });
            break;
          default:
            console.error('Operação desconhecida: ', payload.op);
        }
        return;
      }

      if (payload.entity === 'tarefa') {
        payload.data.id = setTarefaId(payload.data.id);

        switch (payload.op) {
          case 'DELETE': {
            setTarefasPorColuna(prev => {
              const map = {};

              for (const idColuna in prev) {
                map[idColuna] = prev[idColuna].filter(tarefa => tarefa.id !== payload.data.id);
              }

              return map;
            });
            break;
          }

          case 'UPDATE': {

            const novaTarefa = payload.data;
            const usuario = espacoUsuariosRef.current.find(u => Number(u.id) === Number(novaTarefa.id_responsavel));
            novaTarefa.usuario = usuario ?? null;

            setTarefasPorColuna(prev => {

              const map = {};

              for (const idColuna in prev) {
                const tarefas = [...prev[idColuna]];
                const tarefaIndex = tarefas.findIndex(t => t.id === novaTarefa.id);

                if (tarefaIndex >= 0) {
                  tarefas.splice(tarefaIndex, 1);
                }

                map[idColuna] = tarefas;
              }

              if (!map[novaTarefa.id_coluna]) {
                map[novaTarefa.id_coluna] = [];
              }

              const tarefaExistente = map[novaTarefa.id_coluna].find(t => t.id === novaTarefa.id);

              if(!tarefaExistente){
                map[novaTarefa.id_coluna].splice(novaTarefa.ordem, 0, novaTarefa);
              }

              return map;
            });
            break;
          }

          case 'INSERT': {
            const novaTarefa = payload.data;
            const usuario = espacoUsuariosRef.current.find(u => Number(u.id) === Number(novaTarefa.id_responsavel));
            novaTarefa.usuario = usuario ?? null;

            setTarefasPorColuna(prev => {
              const map = {};

              for(const idColuna in prev) map[idColuna] = [...prev[idColuna]];

              if(!map[novaTarefa.id_coluna]){
                console.error('Coluna não existente ou inativa');
                return prev;
              }

              const tarefaExiste = map[novaTarefa.id_coluna].find(tarefa => tarefa.id === novaTarefa.id);

              if (!tarefaExiste) {
                map[novaTarefa.id_coluna].push(novaTarefa);
              }

              return map;
            });
            break;
          }
        }
        return;
      }

      console.error('Tipo de identidade desconhecido');
    };

    socket.on('connect', handleConnect);
    socket.on('connect_error', handleConnectError);
    socket.on('tarefas', handleTarefas);

    return () => {
      if (socket.connected) {
        socket.emit('leave_quadro', { id_espaco: idEspaco });
      }
      socket.off('connect', handleConnect);
      socket.off('connect_error', handleConnectError);
      socket.off('tarefas', handleTarefas);
      socket.disconnect();
    };
  }, [espaco?.id]);

  // Buscar tarefas, colunas e usuários
  const fetchData = async () => {
    try {
      setIsLoading(true);
      const [tarefas, colunas, usuarios] = await Promise.all([
        await fetchTarefas(espaco.id),
        await fetchColunas(espaco.id),
        await fetchUsuarios(espaco.id),
      ]);

      // Atribuindo responsáveis aos cartões
      for (const tarefa of tarefas) {
        const usuario = usuarios.find(u => Number(u.id) === Number(tarefa.id_responsavel));

        if (usuario) {
          tarefa.usuario = usuario;
        }
      }


      const colunasAtivas = colunas.filter(coluna => coluna.ativo === true);

      const map = {};
      for (const coluna of colunasAtivas) {
        if (coluna.ativo) {
          map[coluna.id] = tarefas.filter(tarefa => Number(tarefa.id_coluna) === Number(coluna.id)) ?? [];
          map[coluna.id].sort((a, b) => a.ordem - b.ordem);
        }
      }

      setIdColunas(colunasAtivas.map(col => col.id));
      setColunas(colunasAtivas);
      setTarefasPorColuna(map);
      setEspacoUsuarios(usuarios);
    } catch (error) {
      catchAuthAxios(error, 'Erro ao listar dados do quadro');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [espaco]);

  useEffect(() => {
    if (arrastandoTarefa.current === true) {
      precisaAtualizarTarefas.current = true;
    }
  }, [tarefasPorColuna]);

  useEffect(() => {
    if (arrastandoColuna.current === true) {
      precisaAtualizarColunas.current = true;
    }
  }, [idColunas]);

  const handleOpenMenu = useCallback((event, coluna) => {
    setMenu({ anchorEl: event.currentTarget, coluna });
  }, []);

  const handleCloseMenu = useCallback(() => {
    setMenu({ anchorEl: null, coluna: null });
  }, []);

  const handleBoardPointerDown = useCallback((event) => {
    if (event.pointerType !== 'mouse' || event.button !== 0) return;

    const ignoredElement = event.target.closest?.(
      '[data-board-pan-ignore="true"], button, a, input, textarea, select, [role="button"]'
    );
    if (ignoredElement) return;

    const board = event.currentTarget;
    boardPanRef.current = {
      active: true,
      pointerId: event.pointerId,
      startX: event.clientX,
      scrollLeft: board.scrollLeft,
    };
    board.setPointerCapture(event.pointerId);
    setIsBoardPanning(true);
  }, []);

  const handleBoardPointerMove = useCallback((event) => {
    const pan = boardPanRef.current;
    if (!pan.active || pan.pointerId !== event.pointerId) return;

    event.preventDefault();
    event.currentTarget.scrollLeft = pan.scrollLeft - (event.clientX - pan.startX);
  }, []);

  const handleBoardPointerEnd = useCallback((event) => {
    const pan = boardPanRef.current;
    if (!pan.active || pan.pointerId !== event.pointerId) return;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    boardPanRef.current = { active: false, pointerId: null, startX: 0, scrollLeft: 0 };
    setIsBoardPanning(false);
  }, []);

  const handleNovaTarefa = useCallback((id_coluna) => {
    setTarefaModal({
      open: true,
      data: {
        mode: 'create',
        initialValues: {
          id_espaco: espaco.id,
          id_coluna
        }
      }
    });
  }, [espaco]);

  const handleEditarTarefa = useCallback((tarefa) => {
    setTarefaModal({
      open: true,
      data: {
        mode: 'edit',
        initialValues: { ...tarefa, id: getTarefaId(tarefa.id) }
      }
    });
  }, []);

  useEffect(() => {
    const tarefaId = Number(tarefaIdInicial);

    if (!Number.isInteger(tarefaId) || tarefaId <= 0) {
      tarefaAbertaPelaNavegacaoRef.current = null;
      return;
    }

    if (tarefaAbertaPelaNavegacaoRef.current === tarefaId) return;

    const tarefa = Object.values(tarefasPorColuna)
      .flat()
      .find((item) => getTarefaId(item.id) === tarefaId);

    if (!tarefa) return;

    tarefaAbertaPelaNavegacaoRef.current = tarefaId;
    handleEditarTarefa(tarefa);
  }, [handleEditarTarefa, tarefaIdInicial, tarefasPorColuna]);

  const handleFecharTarefaModal = useCallback(() => {
    setTarefaModal({
      open: false,
      data: {}
    });

    if (router.query.tarefa) {
      const nextQuery = { ...router.query };
      delete nextQuery.tarefa;
      router.replace({ pathname: router.pathname, query: nextQuery }, undefined, { shallow: true });
    }
  }, [router]);

  const handleNovaColuna = useCallback(() => {
    setColunaModal({
      open: true,
      data: {
        mode: 'create',
        initialValues: {
          id_espaco: espaco.id,
        }
      }
    });
  }, [espaco]);

  const handleEditarColuna = useCallback((coluna) => {
    setColunaModal({
      open: true,
      data: {
        mode: 'edit',
        initialValues: { ...coluna }
      }
    });
  }, []);

  const handleFecharColunaModal = useCallback(() => {
    setColunaModal({
      open: false,
      data: {}
    });
  }, []);

  const handleOptionClick = useCallback((option) => {
    const coluna = menu.coluna;

    handleCloseMenu();

    if (!coluna) return;

    option.handleClick(coluna);

  }, [menu, handleCloseMenu]);

  const atualizarTarefas = useCallback(async () => {
    try {
      const data = {
        id_espaco: espaco.id,
        tarefas: []
      };

      for (const idColuna in tarefasPorColuna) {
        const tarefas = tarefasPorColuna[idColuna];

        tarefas.forEach((tarefa, index) => {
          const mudouOrdem = Number(tarefa.ordem) !== Number(index);
          const mudouColuna = Number(tarefa.id_coluna) !== Number(idColuna);
          if (mudouOrdem || mudouColuna) {
            data.tarefas.push({ id: getTarefaId(tarefa.id), ordem: index, id_coluna: idColuna });
          }
        });
      }

      if (data.tarefas.length === 0) {
        return;
      }

      const res = await authAxios('PATCH', '/api/tarefas/atualizarTarefasEmMassa', data);
    } catch (error) {
      catchAuthAxios(error, 'Erro ao atualizar tarefas');
    }
  }, [setIsLoading, tarefasPorColuna]);

  const atualizarColunas = useCallback(async () => {
    try {
      const data = {
        id_espaco: espaco.id,
        colunas: []
      };

      idColunas.forEach((idColuna, index) => {
        const coluna = colunas.find(col => Number(col.id) === idColuna);

        if (coluna && coluna.ordem !== index) {
          data.colunas.push({ id: coluna.id, ordem: index });
        }
      });

      const res = await authAxios('PATCH', '/api/colunas/atualizarColunasEmMassa', data);
    } catch (error) {
      catchAuthAxios();
    }
  }, [setIsLoading, idColunas]);

  const handleDragStart = (e) => {

    const { type } = e?.operation?.source;

    if (type == 'tarefa') {
      arrastandoTarefa.current = true;
    }

    if (type == 'coluna') {
      arrastandoColuna.current = true;
    }
  }

  const handleDragOver = (e) => {
    const { source, target } = e.operation;

    if (source?.id === target?.id && source?.type === target?.type) {
      return;
    }

    if (source?.type === 'tarefa') {
      setTarefasPorColuna(t => move(t, e));
    }

    if (source?.type === 'coluna') {
      setIdColunas(cols => move(cols, e));
    }

  };

  const handleDragEnd = async (e) => {
    if (precisaAtualizarTarefas.current === true) {
      await atualizarTarefas();
      precisaAtualizarTarefas.current = false;
      arrastandoTarefa.current = false;
    }

    if (precisaAtualizarColunas.current === true) {
      await atualizarColunas();
      precisaAtualizarColunas.current = false;
      arrastandoColuna.current = false;
    }

    const { source, target } = e.operation;

    if (e.canceled) {
      return;
    }

  };

  const menuOptions = useMemo(() => [
    { label: 'Adicionar tarefa', icon: AddIcon, handleClick: (coluna) => handleNovaTarefa(coluna.id) },
    { label: 'Editar coluna', icon: EditIcon, handleClick: (coluna) => handleEditarColuna(coluna) },
  ], [handleNovaTarefa, handleNovaColuna]);

  return (
    <>
      <Head>
        <title>Tarefas</title>
        <meta name="description" content="Tela de tarefas" />
      </Head>

      {isLoading ? <Loading /> : null}

      <Dialog open={tarefaModal.open} onClose={handleFecharTarefaModal} maxWidth="lg" fullWidth slotProps={{ paper: { sx: { p: 3, position: 'relative' } } }} >
        <ModalCloseButton onClick={handleFecharTarefaModal} />
        <TarefaFormulario
          mode={tarefaModal.data?.mode}
          initialValues={tarefaModal.data?.initialValues}
          onClose={handleFecharTarefaModal}
          colunas={colunas}
          writePermission={writePermission}
          usuarios={espacoUsuarios}
        />
      </Dialog>

      <Dialog open={colunaModal.open} onClose={handleFecharColunaModal} maxWidth="sm" fullWidth slotProps={{ paper: { sx: { p: 3, position: 'relative' } } }} >
        <ModalCloseButton onClick={handleFecharColunaModal} />
        <ColunaFormulario
          mode={colunaModal.data?.mode}
          initialValues={colunaModal.data?.initialValues}
          onClose={handleFecharColunaModal}
          writePermission={writePermission}
        />
      </Dialog>

      <Menu open={Boolean(menu.anchorEl)} onClose={handleCloseMenu} anchorEl={menu.anchorEl}>
        {menuOptions.map(option => {
          const Icon = option.icon;

          return (
            <MenuItem key={option.label} onClick={() => handleOptionClick(option)} >
              <Stack direction='row' spacing={2} justifyContent='start'>
                <Icon />
                <Typography>{option.label}</Typography>
              </Stack>
            </MenuItem>
          )
        })}
      </Menu>

      <DragDropProvider onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd} >
        <Stack
          direction="row"
          spacing={2}
          onPointerDown={handleBoardPointerDown}
          onPointerMove={handleBoardPointerMove}
          onPointerUp={handleBoardPointerEnd}
          onPointerCancel={handleBoardPointerEnd}
          sx={{
            overflowX: 'auto',
            overflowY: 'hidden',
            justifyContent: 'flex-start',
            alignItems: 'flex-start',
            py: 1,
            cursor: isBoardPanning ? 'grabbing' : 'default',
            userSelect: isBoardPanning ? 'none' : 'auto',
            ...scrollbarSx,
          }}
        >
          {idColunas.map((idColuna, index) => {
            const coluna = colunas.find(col => Number(col.id) == Number(idColuna));

            if (!coluna) return null;

            return (
              <Coluna
                id={idColuna}
                index={index}
                coluna={coluna}
                qtdTarefas={tarefasPorColuna[idColuna]?.length ?? 0}
                key={idColuna}
                handleOpenMenu={handleOpenMenu}
                writePermission={writePermission}
              >
                {tarefasPorColuna[idColuna].map((tarefa, index) => (
                  <TarefaCard
                    id={tarefa.id}
                    espaco={espaco}
                    idColuna={idColuna}
                    tarefa={tarefa}
                    index={index}
                    key={tarefa.id}
                    handleEditarTarefa={handleEditarTarefa}
                    writePermission={writePermission}
                  />
                ))}
                <Card sx={{ textAlign: 'start' }} key='nova-tarefa' >
                  <Button
                    onClick={() => handleNovaTarefa(idColuna)}
                    variant='text'
                    startIcon={<AddIcon />}
                    size='small'
                    sx={{ justifyContent: 'flex-start', textTransform: 'none' }}
                    fullWidth
                    disabled={writePermission === false}
                  >
                    Adicionar Tarefa
                  </Button>
                </Card>
              </Coluna>
            )
          })}
          {writePermission === false ? null : (
            <Box key='nova-coluna' {...colunaBoxProps({ id: 'nova-coluna', nome: 'Nova Coluna' })}>
              <Button
                variant='text'
                startIcon={<AddIcon />}
                fullWidth
                sx={{ justifyContent: 'flex-start', textTransform: 'none' }}
                onClick={handleNovaColuna}
                disabled={writePermission === false}
              >
                Adicionar Coluna
              </Button>
            </Box>
          )}
        </Stack>
      </DragDropProvider>

    </>
  );
}
