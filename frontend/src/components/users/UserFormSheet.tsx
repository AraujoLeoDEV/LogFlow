import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { api } from '@/lib/api';
import { roleOptions } from '@/lib/roles';
import type { CreateUserPayload, UpdateUserPayload, User } from '@/types/user';
import type { Unit } from '@/types/unit';

const ROLE_VALUES = ['ADMIN', 'COORDENACAO', 'MOTORISTA', 'FINANCEIRO', 'CONFERENTE'] as const;

function buildSchema(isEditing: boolean) {
  return z
    .object({
      name: z.string().min(1, 'Informe o nome.'),
      email: z.string().min(1, 'Informe o e-mail.').email('Informe um e-mail válido.'),
      role: z.enum(ROLE_VALUES, { message: 'Selecione um perfil.' }),
      unitId: z.string(),
      isActive: z.boolean(),
      password: isEditing
        ? z.union([z.literal(''), z.string().min(6, 'A senha deve ter no mínimo 6 caracteres.')])
        : z.string().min(6, 'A senha deve ter no mínimo 6 caracteres.'),
    })
    .refine((data) => data.role !== 'CONFERENTE' || data.unitId !== '', {
      message: 'Selecione a unidade para o perfil Conferente.',
      path: ['unitId'],
    });
}

type UserFormValues = z.infer<ReturnType<typeof buildSchema>>;

interface UserFormSheetProps {
  open: boolean;
  user: User | null;
  isSubmitting: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmitCreate: (payload: CreateUserPayload) => void;
  onSubmitUpdate: (id: string, payload: UpdateUserPayload) => void;
}

const EMPTY_VALUES: UserFormValues = {
  name: '',
  email: '',
  role: 'MOTORISTA',
  unitId: '',
  isActive: true,
  password: '',
};

export function UserFormSheet({
  open,
  user,
  isSubmitting,
  onOpenChange,
  onSubmitCreate,
  onSubmitUpdate,
}: UserFormSheetProps) {
  const isEditing = !!user;

  const form = useForm<UserFormValues>({
    resolver: zodResolver(buildSchema(isEditing)),
    defaultValues: EMPTY_VALUES,
  });

  const role = form.watch('role');
  const showUnitField = role === 'CONFERENTE';

  const { data: units } = useQuery({
    queryKey: ['units'],
    queryFn: async () => (await api.get<Unit[]>('/units')).data,
    enabled: showUnitField,
  });

  const activeUnits = (units ?? []).filter((unit) => unit.active);

  useEffect(() => {
    if (open) {
      form.reset(
        user
          ? {
              name: user.name,
              email: user.email,
              role: user.role,
              unitId: user.unitId ?? '',
              isActive: user.isActive,
              password: '',
            }
          : EMPTY_VALUES,
      );
    }
  }, [open, user, form]);

  function onSubmit(values: UserFormValues) {
    const unitId = values.role === 'CONFERENTE' ? values.unitId : '';

    if (isEditing && user) {
      const payload: UpdateUserPayload = {
        name: values.name,
        email: values.email,
        role: values.role,
        unitId: unitId || null,
        isActive: values.isActive,
      };
      if (values.password) {
        payload.password = values.password;
      }
      onSubmitUpdate(user.id, payload);
    } else {
      onSubmitCreate({
        name: values.name,
        email: values.email,
        role: values.role,
        unitId: unitId || undefined,
        password: values.password,
      });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar usuário' : 'Novo usuário'}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Atualize os dados do usuário. Deixe a senha em branco para não alterá-la.'
              : 'Preencha os dados para criar um novo usuário do sistema.'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4"
          >
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>E-mail</FormLabel>
                  <FormControl>
                    <Input type="email" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Perfil</FormLabel>
                  <FormControl>
                    <Select {...field}>
                      {roleOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </Select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {showUnitField && (
              <FormField
                control={form.control}
                name="unitId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Unidade</FormLabel>
                    <FormControl>
                      <Select {...field}>
                        <option value="">Selecione a unidade</option>
                        {activeUnits.map((unit) => (
                          <option key={unit.id} value={unit.id}>
                            {unit.name}
                          </option>
                        ))}
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{isEditing ? 'Nova senha (opcional)' : 'Senha'}</FormLabel>
                  <FormControl>
                    <Input type="password" autoComplete="new-password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {isEditing && (
              <FormField
                control={form.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem>
                    <label className="flex items-center gap-2 text-sm font-medium">
                      <input
                        type="checkbox"
                        checked={field.value}
                        onChange={(event) => field.onChange(event.target.checked)}
                        className="size-4 rounded border-input"
                      />
                      Usuário ativo
                    </label>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            <DialogFooter className="mt-auto px-0">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Salvando...' : 'Salvar'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
