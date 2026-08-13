// React
import { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { toast } from 'react-toastify';

// MUI
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';

// Utils
import authAxios from "@/utils/authAxios";
import catchAuthAxios from "@/utils/catchAxios";

// Components
import Loading from '@/components/common/Loading';

const PermissoesFormulario = ({ usuario, espaco, readonly }) => {

    const [permissoes, setPermissoes] = useState();
    const [isLoading, setIsLoading] = useState(false);

    const { control, handleSubmit, reset } = useForm({ defaultValues: {} });

    const options = [
        { value: 'NONE', label: 'Sem permissão', data: null },
        { value: 'READ', label: 'Apenas leitura', data: false },
        { value: 'WRITE', label: 'Escrita', data: true },
    ];

    useEffect(() => {
        if (!usuario || !espaco) return;
        const fetchPermissoes = async () => {
            try {
                setIsLoading(true);
                const params = new URLSearchParams({ id_espaco: espaco.id, id_usuario: usuario.id });
                const res = await authAxios('GET', `/api/espacos/listarPermissoes?${params.toString()}`);
                const localPermissoes = res.data.data;

                const formObj = {};
                for (const permissao of localPermissoes) {
                    formObj[permissao.id] = options.find(option => option.data === permissao.escrita).value;
                }

                reset(formObj);
                setPermissoes(localPermissoes);
            } catch (error) {
                console.error(error);
                catchAuthAxios(error, 'Erro ao buscar permissões de usuário. Contate o suporte');
            } finally {
                setIsLoading(false);
            }
        };

        fetchPermissoes();
    }, [usuario, espaco]);

    const onSubmit = async (data) => {
        try {
            setIsLoading(true);

            const payload = {};
            payload.id_usuario = usuario.id;
            payload.id_espaco = espaco.id;
            payload.permissions = [];
            for (const idPermissao in data) {
                payload.permissions.push({
                    id_permissao: Number(idPermissao),
                    escrita: data[idPermissao]
                });
            }

            const res = await authAxios('POST', '/api/espacos/alterarPermissoes', payload);

            toast.success(res.data.mensagem);
        } catch (error) {
            console.error(error);
            catchAuthAxios(error, 'Erro ao salvar permissões!');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Box sx={{ width: '100%', mx: 'auto' }}>
            {isLoading && <Loading />}
            <form onSubmit={handleSubmit(onSubmit)}>
                <Stack spacing={2.5}>
                    <Typography component="h3" variant="h4" align='center'>
                        Permissões de usuário
                    </Typography>
                    {permissoes && permissoes.map(permissao => (
                        <Controller
                            key={`permissao-${permissao.id}`}
                            name={String(permissao.id)}
                            control={control}
                            defaultValue='NONE'
                            render={({ field }) => (
                                <TextField
                                    {...field}
                                    id={`permissao-${permissao.id}`}
                                    key={`permissao-${permissao.id}`}
                                    select
                                    defaultValue="NONE"
                                    label={permissao.nome}
                                    helperText={permissao.descricao}
                                    disabled={isLoading || readonly}
                                >
                                    {options.map(option => {
                                        if (permissao.nome === 'ESPACO' && option.value === 'NONE') {
                                            return null;
                                        }

                                        return (
                                            <MenuItem key={option.value} value={option.value}>
                                                {option.label}
                                            </MenuItem>
                                        )
                                    })}
                                </TextField>
                            )}
                        />
                    ))}

                    <Button variant='contained' type='submit' color='success' disabled={isLoading}>
                        Salvar
                    </Button>
                </Stack>
            </form>
        </Box>
    )
};

export default PermissoesFormulario;
