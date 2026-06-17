import { zodResolver } from '@hookform/resolvers/zod';
import { AxiosError } from 'axios';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useSearchParams } from 'react-router-dom';
import { z } from 'zod';

import logoIcon from '@/assets/logo-icon.png';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';

const schema = z
  .object({
    password: z.string().min(6, 'A senha deve ter pelo menos 6 caracteres.'),
    confirmPassword: z.string().min(1, 'Confirme sua senha.'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'As senhas não coincidem.',
    path: ['confirmPassword'],
  });

type FormValues = z.infer<typeof schema>;

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const [done, setDone] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { password: '', confirmPassword: '' },
  });

  async function onSubmit(values: FormValues) {
    setErrorMessage(null);
    setIsSubmitting(true);
    try {
      await api.post('/auth/reset-password', { token, password: values.password });
      setDone(true);
    } catch (error) {
      if (error instanceof AxiosError) {
        const message = (error.response?.data as { message?: string } | undefined)?.message;
        setErrorMessage(message ?? 'Não foi possível redefinir a senha. Tente novamente.');
      } else {
        setErrorMessage('Não foi possível conectar ao servidor. Tente novamente.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#221a45] to-[#0c0e1c] p-4">
        <Card className="w-full max-w-sm">
          <CardContent className="pt-6 text-center">
            <p className="mb-4 text-sm text-muted-foreground">
              Link inválido. Solicite um novo link de redefinição de senha.
            </p>
            <Link to="/esqueci-senha">
              <Button variant="outline" className="w-full">
                Solicitar novo link
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-[#221a45] to-[#0c0e1c] p-4">
      <div className="pointer-events-none absolute -top-32 -left-32 size-96 rounded-full bg-primary/40 blur-3xl" />
      <div className="pointer-events-none absolute -right-32 -bottom-32 size-96 rounded-full bg-[#5b3df5]/30 blur-3xl" />
      <div className="relative mb-6 flex flex-col items-center gap-2">
        <img src={logoIcon} alt="" className="size-16 rounded-2xl shadow-lg" />
        <span className="bg-gradient-to-r from-blue-400 to-violet-400 bg-clip-text text-2xl font-bold text-transparent">
          LogFlow
        </span>
      </div>
      <Card className="relative w-full max-w-sm shadow-2xl">
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Redefinir senha</CardTitle>
          <CardDescription>Digite sua nova senha abaixo.</CardDescription>
        </CardHeader>
        <CardContent>
          {done ? (
            <div className="flex flex-col gap-4 text-center">
              <p className="text-sm text-muted-foreground">
                Senha redefinida com sucesso! Agora você pode fazer login com a nova senha.
              </p>
              <Link to="/login">
                <Button className="w-full">Ir para o login</Button>
              </Link>
            </div>
          ) : (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nova senha</FormLabel>
                      <FormControl>
                        <Input type="password" autoComplete="new-password" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Confirmar nova senha</FormLabel>
                      <FormControl>
                        <Input type="password" autoComplete="new-password" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {errorMessage && (
                  <p className="text-sm text-destructive" role="alert">
                    {errorMessage}
                  </p>
                )}
                <Button type="submit" disabled={isSubmitting} className="mt-2 w-full">
                  {isSubmitting ? 'Salvando...' : 'Redefinir senha'}
                </Button>
              </form>
            </Form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
