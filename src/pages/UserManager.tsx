import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, UserPlus, Trash2, ShieldCheck, Key, User as UserIcon, Stethoscope, LogOut } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';

interface UserRole {
    id: string;
    username: string;
    password: string;
    role: 'manager' | 'receptionist' | 'doctor';
    initial?: string;
    created_at: string;
    source: 'roles' | 'doctors';
}

const UserManager = () => {
    const { signOut } = useAuth();
    const navigate = useNavigate();
    const [users, setUsers] = useState<UserRole[]>([]);
    const [loading, setLoading] = useState(true);
    const [newUsername, setNewUsername] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [newRole, setNewRole] = useState<'manager' | 'receptionist' | 'doctor'>('receptionist');
    const [newInitial, setNewInitial] = useState('');
    const [isAdding, setIsAdding] = useState(false);

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const { data: rolesData, error: rolesError } = await (supabase as any).from('roles').select('*');
            const { data: doctorsData, error: doctorsError } = await (supabase as any).from('doctors').select('*');

            if (rolesError) throw rolesError;
            if (doctorsError) throw doctorsError;

            const combined: UserRole[] = [
                ...(rolesData || []).map((r: any) => ({ ...r, source: 'roles' })),
                ...(doctorsData || []).map((d: any) => ({
                    id: d.id,
                    username: d.name,
                    password: d.password,
                    role: 'doctor',
                    initial: d.initial,
                    created_at: d.created_at,
                    source: 'doctors'
                }))
            ];

            setUsers(combined.sort((a, b) => a.username.localeCompare(b.username)));
        } catch (error) {
            console.error('Error fetching users:', error);
            toast.error('Erreur lors du chargement des accès');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUsers();
    }, []);

    const handleAddUser = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newUsername.trim() || !newPassword.trim()) return;
        if (newRole === 'doctor' && !newInitial.trim()) {
            toast.error('Initiales requises pour un docteur');
            return;
        }

        setIsAdding(true);
        try {
            if (newRole === 'doctor') {
                const { error } = await (supabase as any).from('doctors').insert([{
                    name: newUsername.trim(),
                    password: newPassword.trim(),
                    initial: newInitial.trim().toUpperCase()
                }]);
                if (error) throw error;
            } else {
                const { error } = await (supabase as any).from('roles').insert([{
                    username: newUsername.trim().toLowerCase(),
                    password: newPassword.trim(),
                    role: newRole
                }]);
                if (error) throw error;
            }

            toast.success('Accès ajouté');
            setNewUsername('');
            setNewPassword('');
            setNewInitial('');
            fetchUsers();
        } catch (error: any) {
            console.error('Error adding user:', error);
            toast.error(error.code === '23505' ? 'Utilisateur déjà existant' : 'Erreur lors de la création');
        } finally {
            setIsAdding(false);
        }
    };

    const handleDeleteUser = async (user: UserRole) => {
        if (user.username === 'admin') {
            toast.error('Actions interdites sur ce compte');
            return;
        }

        if (!confirm(`Supprimer ${user.username} ?`)) return;

        try {
            const { error } = await (supabase as any).from(user.source).delete().eq('id', user.id);
            if (error) throw error;
            toast.success('Accès supprimé');
            fetchUsers();
        } catch (error) {
            toast.error('Erreur lors de la suppression');
        }
    };

    return (
        <div className="min-h-[100dvh] bg-background flex flex-col">
            {/* Exactly matching Manager Header */}
            <header className="flex items-center justify-between p-3 sm:p-4 border-b sticky top-0 bg-background z-10 font-sans">
                <div className="flex items-center gap-3">
                    <Button asChild variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(-1)}>
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <div>
                        <h1 className="text-lg sm:text-xl font-bold text-foreground italic leading-none">PasseVite</h1>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Gestion des Accès</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Button asChild variant="ghost" size="sm" className="h-9">
                        <Link to="/manager">
                            <ShieldCheck className="h-4 w-4 mr-1 text-primary" />
                            <span className="hidden sm:inline">Dashboard</span>
                        </Link>
                    </Button>
                    <Button variant="ghost" size="icon" onClick={signOut} className="h-8 w-8"><LogOut className="h-4 w-4" /></Button>
                </div>
            </header>

            <div className="p-3 sm:p-4 space-y-3 sm:space-y-4 font-sans">
                {/* Form Card - Matching Manager Card Style */}
                <Card className="border-0 shadow-sm bg-primary/5 ring-1 ring-primary/10 overflow-hidden rounded-xl">
                    <CardHeader className="p-4 pb-2 border-b border-primary/10 bg-primary/5">
                        <div className="flex items-center gap-2">
                            <UserPlus className="h-4 w-4 text-primary" />
                            <span className="text-xs font-bold uppercase tracking-widest text-primary">Nouveau Compte</span>
                        </div>
                    </CardHeader>
                    <CardContent className="p-4 sm:p-6">
                        <form onSubmit={handleAddUser} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold uppercase text-muted-foreground">Nom / Login</label>
                                <Input
                                    value={newUsername}
                                    onChange={e => setNewUsername(e.target.value)}
                                    className="h-9 sm:h-10 text-sm bg-white"
                                    placeholder="Ex: Dr. Ahmed"
                                    required
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold uppercase text-muted-foreground">Mot de Passe</label>
                                <Input
                                    value={newPassword}
                                    onChange={e => setNewPassword(e.target.value)}
                                    className="h-9 sm:h-10 text-sm bg-white"
                                    placeholder="••••••"
                                    required
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold uppercase text-muted-foreground">Rôle</label>
                                <Select value={newRole} onValueChange={(v: any) => setNewRole(v)}>
                                    <SelectTrigger className="h-9 sm:h-10 text-sm bg-white"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="receptionist">Réceptionniste</SelectItem>
                                        <SelectItem value="manager">Manager</SelectItem>
                                        <SelectItem value="doctor">Médecin</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="flex gap-2 w-full">
                                {newRole === 'doctor' && (
                                    <div className="flex-1 space-y-1">
                                        <label className="text-[10px] font-bold uppercase text-muted-foreground">Initiales</label>
                                        <Input
                                            value={newInitial}
                                            onChange={e => setNewInitial(e.target.value)}
                                            className="h-9 sm:h-10 text-sm bg-white uppercase"
                                            maxLength={3}
                                            placeholder="JD"
                                        />
                                    </div>
                                )}
                                <Button type="submit" disabled={isAdding} className="h-9 sm:h-10 px-6 font-bold uppercase text-[10px] tracking-widest">
                                    {isAdding ? '...' : 'Ajouter'}
                                </Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>

                {/* Users List - Card view on mobile, table on desktop */}
                <div className="sm:hidden space-y-2">
                    {loading ? (
                        <p className="text-center py-8 text-[10px] uppercase font-bold text-muted-foreground animate-pulse">Chargement...</p>
                    ) : (
                        users.map(u => (
                            <Card key={`${u.source}-${u.id}`} className="border-0 shadow-sm">
                                <CardContent className="p-3 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${u.role === 'doctor' ? 'bg-blue-100 text-blue-600' : 'bg-primary/10 text-primary'
                                            }`}>
                                            {u.role === 'doctor' ? <Stethoscope className="h-4 w-4" /> : <UserIcon className="h-4 w-4" />}
                                        </div>
                                        <div>
                                            <p className="font-bold text-sm text-foreground uppercase tracking-tight leading-none">{u.username}</p>
                                            <span className="text-[9px] font-black opacity-40 uppercase">{u.role}</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="text-right">
                                            <p className="text-[10px] font-mono bg-muted px-1.5 py-0.5 rounded">{u.password}</p>
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-7 w-7 text-destructive hover:bg-destructive/10 rounded-full"
                                            onClick={() => handleDeleteUser(u)}
                                            disabled={u.username === 'admin'}
                                        >
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        ))
                    )}
                </div>

                <Card className="border-0 shadow-sm overflow-hidden hidden sm:block rounded-xl">
                    <Table>
                        <TableHeader className="bg-muted/40">
                            <TableRow>
                                <TableHead className="text-[10px] uppercase font-black pl-6">Utilisateur</TableHead>
                                <TableHead className="text-[10px] uppercase font-black">Rôle</TableHead>
                                <TableHead className="text-[10px] uppercase font-black">Mot de Passe</TableHead>
                                <TableHead className="text-[10px] uppercase font-black">Détails</TableHead>
                                <TableHead className="w-[80px]"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow><TableCell colSpan={5} className="text-center py-12 text-[10px] uppercase font-bold text-muted-foreground animate-pulse tracking-widest">Récupération des accès...</TableCell></TableRow>
                            ) : (
                                users.map(u => (
                                    <TableRow key={`${u.source}-${u.id}`} className="group hover:bg-muted/10 transition-colors">
                                        <TableCell className="font-bold uppercase tracking-tight text-sm pl-6">{u.username}</TableCell>
                                        <TableCell>
                                            <span className={`text-[9px] px-2 py-0.5 rounded-full font-black uppercase ring-1 ring-inset ${u.role === 'manager' ? 'bg-amber-50 text-amber-600 ring-amber-500/20' :
                                                    u.role === 'doctor' ? 'bg-blue-50 text-blue-600 ring-blue-500/20' :
                                                        'bg-emerald-50 text-emerald-600 ring-emerald-500/20'
                                                }`}>
                                                {u.role === 'manager' ? 'Manager' : u.role === 'doctor' ? 'Médecin' : 'Accueil'}
                                            </span>
                                        </TableCell>
                                        <TableCell>
                                            <code className="text-xs bg-muted px-2 py-1 rounded select-all font-mono">{u.password}</code>
                                        </TableCell>
                                        <TableCell className="text-[10px] font-bold text-muted-foreground uppercase">
                                            {u.role === 'doctor' && `Init: ${u.initial}`}
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-full"
                                                    onClick={() => handleDeleteUser(u)}
                                                    disabled={u.username === 'admin'}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </Card>
            </div>
        </div>
    );
};

export default UserManager;
