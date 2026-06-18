import { zodResolver } from '@hookform/resolvers/zod';
import { AxiosError } from 'axios';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';
import { z } from 'zod';

import { AuthHero } from '@/components/layout/AuthHero';
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

const schema = z.object({
  email: z.string().min(1, 'Informe seu e-mail.').email('Informe um e-mail válido.'),
});

type FormValues = z.infer<typeof schema>;

export function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: '' },
  });

  async function onSubmit(values: FormValues) {
    setErrorMessage(null);
    setIsSubmitting(true);
    try {
      await api.post('/auth/forgot-password', values);
      setSent(true);
    } catch (error) {
      if (error instanceof AxiosError && error.response?.status === 429) {
        setErrorMessage('Muitas tentativas. Aguarde um minuto e tente novamente.');
      } else {
        setErrorMessage('Não foi possível processar a solicitação. Tente novamente.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthHero>
      <Card className="relative w-full max-w-sm border-white/10 bg-white/[0.04] shadow-2xl backdrop-blur-xl">
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Esqueci minha senha</CardTitle>
          <CardDescription>
            Informe seu e-mail e enviaremos um link para redefinir sua senha.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {sent ? (
            <div className="flex flex-col gap-4 text-center">
              <p className="text-sm text-muted-foreground">
                Se o e-mail estiver cadastrado, você receberá um link de redefinição em breve.
                Verifique sua caixa de entrada (e a pasta de spam).
              </p>
              <Link to="/login">
                <Button variant="outline" className="w-full">
                  Voltar ao login
                </Button>
              </Link>
            </div>
          ) : (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>E-mail</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="seu@email.com"
                          autoComplete="username"
                          {...field}
                        />
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
                  {isSubmitting ? 'Enviando...' : 'Enviar link de redefinição'}
                </Button>
                <Link
                  to="/login"
                  className="text-center text-sm text-muted-foreground hover:text-foreground"
                >
                  Voltar ao login
                </Link>
              </form>
            </Form>
          )}
        </CardContent>
      </Card>
    </AuthHero>
  );
}
