"use client";

import Head from "next/head";
import Router from "next/router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "react-toastify";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Container from "@mui/material/Container";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";

import axios from "axios";

const defaultValues = {
  email: "",
  nome: "",
  username: "",
  senha: "",
};

export default function NovoUsuarioPage() {
  const [isLoading, setIsLoading] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm({ defaultValues });

  const onSubmit = async (data) => {
    try {
      setIsLoading(true);
      console.log(data);
      const res = await axios.post("/api/usuarios/novo", data);
      toast.success(res.data.mensagem);
      Router.push('/usuarios/login');
    } catch (error) {
      console.error(error.response || error);
      toast.error(error.response?.data?.mensagem || "Erro ao cadastrar usuário.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Head>
        <title>Novo usuário</title>
        <meta name="description" content="Cadastro de usuário" />
      </Head>

      <Container maxWidth="sm" component="main" sx={{ py: 4 }}>
        <Typography component="h1" variant="h3" align="center" sx={{ mb: 4 }}>
          Novo usuário
        </Typography>

        <Box component="form" onSubmit={handleSubmit(onSubmit)}>
          <Stack spacing={2.5}>
            <TextField
              label="E-mail"
              type="email"
              fullWidth
              required
              disabled={isLoading}
              error={!!errors.email}
              helperText={errors.email?.message}
              {...register("email", {
                required: "E-mail é obrigatório.",
                pattern: {
                  value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                  message: "Informe um e-mail válido.",
                },
              })}
            />

            <TextField
              label="Nome"
              fullWidth
              required
              disabled={isLoading}
              error={!!errors.nome}
              helperText={errors.nome?.message}
              {...register("nome", {
                required: "Nome é obrigatório.",
              })}
            />

            <TextField
              label="Username"
              fullWidth
              required
              disabled={isLoading}
              error={!!errors.username}
              helperText={errors.username?.message}
              {...register("username", {
                required: "Username é obrigatório.",
              })}
            />

            <TextField
              label="Senha"
              type="password"
              fullWidth
              required
              disabled={isLoading}
              error={!!errors.senha}
              helperText={errors.senha?.message}
              {...register("senha", {
                required: "Senha é obrigatória.",
              })}
            />

            <Stack direction="row" spacing={2}>
              <Button variant="contained" color="success" type="submit" disabled={isLoading}>
                {isLoading ? <CircularProgress size={24} color="inherit" /> : "Cadastrar"}
              </Button>
              <Button variant="outlined" type="button" disabled={isLoading} onClick={() => Router.back()}>
                Voltar
              </Button>
            </Stack>
          </Stack>
        </Box>
      </Container>
    </>
  );
}
