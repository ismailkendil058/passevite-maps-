import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
    Phone, Search, CreditCard, CalendarClock, ArrowLeft, Stethoscope,
    CheckCircle2, Clock, AlertCircle, TrendingUp, Banknote, ChevronRight, QrCode
} from 'lucide-react';
import { format, isPast, isFuture, isToday, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import FullscreenQrModal from '@/components/FullscreenQrModal';

/* ─── Types ─── */
interface Visit {
    id: string;
    client_name: string;
    treatment: string;
    total_amount: number;
    tranche_paid: number;
    completed_at: string | null;
    doctor_id: string;
    doctor?: { name: string; initial: string };
}

interface Appointment {
    id: string;
    client_name: string;
    client_phone: string;
    appointment_at: string;
    status: string | null;
    notes: string | null;
    doctor_id: string | null;
    doctor?: { name: string; initial: string } | null;
}

interface TreatmentGroup {
    treatment: string;
    visits: Visit[];
    totalAmount: number;
    totalPaid: number;
    remaining: number;
    lastVisit: string | null;
}

/* ─── Component ─── */
const PatientCard = () => {
    const [phone, setPhone] = useState('');
    const [loading, setLoading] = useState(false);
    const [searched, setSearched] = useState(false);
    const [patientName, setPatientName] = useState('');
    const [visits, setVisits] = useState<Visit[]>([]);
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [expandedTreatment, setExpandedTreatment] = useState<string | null>(null);
    const [treatmentFilter, setTreatmentFilter] = useState<'all' | 'current' | 'completed'>('all');
    const [showHistory, setShowHistory] = useState(false);
    const [showPastAppts, setShowPastAppts] = useState(false);
    const [isQrStickerOpen, setIsQrStickerOpen] = useState(false);

    /* ─── Fetch patient data ─── */
    const fetchPatientData = async () => {
        const trimmed = phone.trim();
        if (!trimmed) return;
        setLoading(true);
        setSearched(true);

        // Fetch all completed_clients entries for this phone
        const { data: visitData } = await supabase
            .from('completed_clients')
            .select('*, doctor:doctors(name, initial)')
            .eq('phone', trimmed)
            .order('completed_at', { ascending: false });

        // Fetch all appointments for this phone
        const { data: apptData } = await supabase
            .from('appointments')
            .select('*, doctor:doctors(name, initial)')
            .eq('client_phone', trimmed)
            .order('appointment_at', { ascending: true });

        if (visitData && visitData.length > 0) {
            setPatientName(visitData[0].client_name);
            setVisits(visitData as Visit[]);
        } else {
            setVisits([]);
        }

        if (apptData && apptData.length > 0) {
            if (!visitData?.length) setPatientName(apptData[0].client_name);
            setAppointments(apptData as unknown as Appointment[]);
        } else {
            setAppointments([]);
        }

        if (!visitData?.length && !apptData?.length) {
            setPatientName('');
        }

        setLoading(false);
    };

    const hasData = visits.length > 0 || appointments.length > 0;

    /* ─── Group visits by treatment ─── */
    const treatmentGroups = useMemo((): TreatmentGroup[] => {
        const map = new Map<string, Visit[]>();
        visits.forEach(v => {
            const key = v.treatment || 'Non spécifié';
            if (!map.has(key)) map.set(key, []);
            map.get(key)!.push(v);
        });
        return Array.from(map.entries()).map(([treatment, grpVisits]) => {
            const totalAmount = grpVisits.reduce((s, v) => s + (v.total_amount || 0), 0);
            const totalPaid = grpVisits.reduce((s, v) => s + (v.tranche_paid || 0), 0);
            return {
                treatment,
                visits: grpVisits,
                totalAmount,
                totalPaid,
                remaining: totalAmount - totalPaid,
                lastVisit: grpVisits[0]?.completed_at || null,
            };
        });
    }, [visits]);

    const filteredTreatmentGroups = useMemo(() => {
        if (treatmentFilter === 'all') return treatmentGroups;
        if (treatmentFilter === 'completed') return treatmentGroups.filter(g => g.remaining <= 0);
        return treatmentGroups.filter(g => g.remaining > 0);
    }, [treatmentGroups, treatmentFilter]);


    /* ─── Upcoming appointments ─── */
    const upcomingAppointments = useMemo(
        () => appointments.filter(a => {
            try {
                const d = parseISO(a.appointment_at);
                return isFuture(d) || isToday(d);
            } catch { return false; }
        }),
        [appointments]
    );

    const pastAppointments = useMemo(
        () => appointments.filter(a => {
            try {
                const d = parseISO(a.appointment_at);
                return isPast(d) && !isToday(d);
            } catch { return false; }
        }).reverse(),
        [appointments]
    );

    /* ─── Reset ─── */
    const handleReset = () => {
        setSearched(false);
        setPhone('');
        setPatientName('');
        setVisits([]);
        setAppointments([]);
        setExpandedTreatment(null);
        setTreatmentFilter('all');
        setShowHistory(false);
        setShowPastAppts(false);
    };

    /* ─── Status helpers ─── */
    const getStatusBadge = (status: string | null) => {
        switch (status) {
            case 'confirmed': return <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30 text-[10px] font-bold">Confirmé</Badge>;
            case 'scheduled': return <Badge className="bg-blue-500/15 text-blue-600 border-blue-500/30 text-[10px] font-bold">Programmé</Badge>;
            case 'coming': return <Badge className="bg-amber-500/15 text-amber-600 border-amber-500/30 text-[10px] font-bold">En route</Badge>;
            case 'denied': return <Badge className="bg-red-500/15 text-red-600 border-red-500/30 text-[10px] font-bold">Refusé</Badge>;
            case 'attended': return <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30 text-[10px] font-bold">Fait</Badge>;
            case 'no_answer': return <Badge className="bg-gray-500/15 text-gray-600 border-gray-500/30 text-[10px] font-bold">Pas de réponse</Badge>;
            default: return <Badge className="bg-gray-500/15 text-gray-500 border-gray-500/30 text-[10px] font-bold">{status || '—'}</Badge>;
        }
    };

    const formatDate = (dateStr: string | null) => {
        if (!dateStr) return '—';
        try { return format(parseISO(dateStr), "d MMM yyyy", { locale: fr }); } catch { return '—'; }
    };

    const formatDateTime = (dateStr: string) => {
        try { return format(parseISO(dateStr), "EEEE d MMM yyyy 'à' HH:mm", { locale: fr }); } catch { return dateStr; }
    };

    const formatShortDate = (dateStr: string) => {
        try { return format(parseISO(dateStr), "d MMM", { locale: fr }); } catch { return ''; }
    };

    const formatTime = (dateStr: string) => {
        try { return format(parseISO(dateStr), "HH:mm"); } catch { return ''; }
    };

    /* ═══════════════════════ RENDER ═══════════════════════ */
    return (
        <div className="min-h-[100dvh] bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/40 flex flex-col">
            {/* ─── Header ─── */}
            <header className="p-4 sm:p-6 text-center border-b bg-white/50 backdrop-blur-md sticky top-0 z-50 gpu">
                <div className="flex flex-col items-center">
                    <div className="inline-block p-1.5 rounded-xl bg-white shadow-lg shadow-primary/5 mb-2 border border-primary/5">
                        <img src="/VitalWeb.png" alt="PasseVite Logo" className="h-8 w-8 object-contain" />
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-black text-primary tracking-tighter italic animate-fade-in gpu">PasseVite</h1>
                    <p className="text-[10px] tracking-[0.3em] text-muted-foreground -mt-1 uppercase font-medium animate-fade-in gpu">le soin qui passe vite</p>
                </div>
            </header>

            <div className="flex-1 overflow-y-auto">
                {/* ─── PHONE INPUT SCREEN ─── */}
                {!searched && (
                    <div className="flex-1 p-4 sm:p-6 flex items-start justify-center pt-12 sm:pt-16 animate-fade-in">
                        <Card className="w-full max-w-md border-0 shadow-2xl shadow-primary/10 bg-white/90 backdrop-blur-sm overflow-hidden rounded-[2rem]">
                            <div className="h-1.5 bg-gradient-to-r from-primary/40 via-primary to-primary/40 animate-pulse" />
                            <CardContent className="p-8 sm:p-10">
                                <div className="text-center mb-8">
                                    <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-primary/5 mb-6 shadow-inner relative overflow-hidden group">
                                        <div className="absolute inset-0 bg-primary/10 translate-y-full group-hover:translate-y-0 transition-transform duration-500" />
                                        <CreditCard className="h-9 w-9 text-primary relative z-10 group-hover:scale-110 transition-transform duration-500" />
                                    </div>
                                    <h2 className="text-xl font-bold text-foreground mb-2">E-Carte Patient</h2>
                                    <p className="text-sm text-muted-foreground leading-relaxed">Entrez votre numéro de téléphone pour consulter votre suivi de soins et paiements.</p>
                                </div>

                                <div className="space-y-4">
                                    <div className="relative">
                                        <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            id="patient-phone-input"
                                            placeholder="0X XX XX XX XX"
                                            value={phone}
                                            onChange={(e) => setPhone(e.target.value)}
                                            type="tel"
                                            className="h-12 pl-10 text-base bg-slate-50/80 border-slate-200 focus:border-indigo-400 focus:ring-indigo-400/20 rounded-xl"
                                            onKeyDown={(e) => e.key === 'Enter' && fetchPatientData()}
                                        />
                                    </div>
                                    <Button
                                        id="patient-search-btn"
                                        onClick={fetchPatientData}
                                        className="w-full h-12 bg-primary hover:bg-primary/90 text-white font-bold rounded-xl shadow-lg shadow-primary/20 transition-all hover:shadow-xl hover:shadow-primary/30"
                                        disabled={loading || !phone.trim()}
                                    >
                                        {loading ? (
                                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                        ) : (
                                            <>
                                                <Search className="h-4 w-4 mr-2" /> Consulter ma carte
                                            </>
                                        )}
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                )}

                {/* ─── NO DATA FOUND ─── */}
                {searched && !loading && !hasData && (
                    <div className="flex-1 p-4 sm:p-6 flex items-start justify-center pt-12 animate-fade-in">
                        <Card className="w-full max-w-md border-0 shadow-xl bg-white/80 backdrop-blur-sm">
                            <CardContent className="p-8 text-center space-y-4">
                                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100 mx-auto">
                                    <AlertCircle className="h-8 w-8 text-red-500" />
                                </div>
                                <div>
                                    <p className="text-lg font-bold text-foreground">Aucun dossier trouvé</p>
                                    <p className="text-sm text-muted-foreground mt-1">Vérifiez votre numéro de téléphone et réessayez.</p>
                                </div>
                                <Button onClick={handleReset} variant="outline" className="rounded-xl">
                                    <ArrowLeft className="h-4 w-4 mr-2" /> Réessayer
                                </Button>
                            </CardContent>
                        </Card>
                    </div>
                )}

                {/* ─── PATIENT E-CARD ─── */}
                {searched && !loading && hasData && (
                    <div className="p-3 sm:p-4 pb-8 space-y-4 max-w-lg mx-auto animate-slide-up">

                        {/* ── Patient Identity Card ── */}
                        <div
                            className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-primary via-primary/90 to-primary/80 p-6 sm:p-8 shadow-2xl shadow-primary/20 cursor-pointer"
                            onClick={() => setIsQrStickerOpen(true)}
                        >
                            <div
                                className="absolute inset-0 opacity-10"
                                style={{
                                    backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
                                }}
                            />
                            <div className="absolute top-0 right-0 w-40 h-40 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
                            <div className="relative z-10">
                                <div className="flex items-start justify-between mb-6">
                                    <div>
                                        <p className="text-[10px] text-white/60 uppercase tracking-[0.3em] font-bold mb-1">Patient</p>
                                        <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tighter italic">{patientName}</h2>
                                        <p className="text-xs text-white/70 mt-1 flex items-center gap-1.5 bg-white/10 w-fit px-2 py-0.5 rounded-full">
                                            <Phone className="h-3 w-3" /> {phone}
                                        </p>
                                    </div>
                                    <div className="flex flex-col items-end gap-2">
                                        <div className="p-1.5 bg-white rounded-xl shadow-lg">
                                            <img src="/VitalWeb.png" alt="Logo" className="h-6 w-6 object-contain" />
                                        </div>
                                        <div className="flex gap-2">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 bg-white/15 hover:bg-white/25 border-white/20 text-white"
                                                onClick={() => setIsQrStickerOpen(true)}
                                            >
                                                <QrCode className="h-4 w-4" />
                                            </Button>
                                            <Badge variant="outline" className="border-white/20 text-white bg-white/10 backdrop-blur-sm text-[10px] uppercase font-bold tracking-widest px-3 py-1">E-CARTE</Badge>
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-3 gap-3 mt-4">
                                    <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 text-center">
                                        <p className="text-xl sm:text-2xl font-black text-white">{visits.length}</p>
                                        <p className="text-[9px] text-white/60 uppercase tracking-wider font-bold mt-0.5">Visites</p>
                                    </div>
                                    <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 text-center">
                                        <p className="text-xl sm:text-2xl font-black text-white">{treatmentGroups.length}</p>
                                        <p className="text-[9px] text-white/60 uppercase tracking-wider font-bold mt-0.5">Soins</p>
                                    </div>
                                    <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 text-center">
                                        <p className="text-xl sm:text-2xl font-black text-white">{upcomingAppointments.length}</p>
                                        <p className="text-[9px] text-white/60 uppercase tracking-wider font-bold mt-0.5">RDV</p>
                                    </div>
                                </div>
                            </div>
                        </div>


                        {/* ── Upcoming Appointments ── */}
                        {upcomingAppointments.length > 0 && (
                            <Card className="border-0 shadow-lg bg-white/90 backdrop-blur-sm rounded-2xl overflow-hidden">
                                <CardContent className="p-5">
                                    <div className="flex items-center gap-2.5 mb-4">
                                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-sm">
                                            <CalendarClock className="h-4 w-4 text-white" />
                                        </div>
                                        <div>
                                            <h3 className="text-sm font-bold text-foreground">Prochains rendez-vous</h3>
                                            <p className="text-[10px] text-muted-foreground">{upcomingAppointments.length} rendez-vous à venir</p>
                                        </div>
                                    </div>

                                    <div className="space-y-2.5">
                                        {upcomingAppointments.map((appt) => (
                                            <div key={appt.id} className="relative bg-gradient-to-r from-blue-50 to-indigo-50/50 rounded-xl p-3.5 border border-blue-100/80">
                                                {isToday(parseISO(appt.appointment_at)) && (
                                                    <div className="absolute top-2 right-2">
                                                        <span className="relative flex h-2.5 w-2.5">
                                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                                                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-500" />
                                                        </span>
                                                    </div>
                                                )}
                                                <div className="flex items-start gap-3">
                                                    <div className="flex-shrink-0 w-12 text-center bg-white rounded-lg py-1.5 shadow-sm border border-blue-100/50">
                                                        <p className="text-lg font-black text-indigo-600 leading-none">{format(parseISO(appt.appointment_at), 'd')}</p>
                                                        <p className="text-[9px] font-bold text-indigo-400 uppercase">{format(parseISO(appt.appointment_at), 'MMM', { locale: fr })}</p>
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-bold text-foreground capitalize">
                                                            {format(parseISO(appt.appointment_at), 'EEEE', { locale: fr })}
                                                            {isToday(parseISO(appt.appointment_at)) && (
                                                                <span className="text-[10px] ml-1.5 text-blue-500 font-bold">Aujourd'hui</span>
                                                            )}
                                                        </p>
                                                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                                                            <Clock className="h-3 w-3" />
                                                            {formatTime(appt.appointment_at)}
                                                            {appt.doctor && (
                                                                <span className="ml-2 flex items-center gap-1">
                                                                    <Stethoscope className="h-3 w-3" /> {(appt.doctor as any)?.name || ''}
                                                                </span>
                                                            )}
                                                        </p>
                                                        {appt.notes && (
                                                            <p className="text-[10px] text-muted-foreground mt-1 italic truncate">{appt.notes}</p>
                                                        )}
                                                    </div>
                                                    <div className="flex-shrink-0 self-center">
                                                        {getStatusBadge(appt.status)}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {/* ── Treatment History (Large Button) ── */}
                        {treatmentGroups.length > 0 && (
                            <Card className={`border-0 shadow-lg bg-white/90 backdrop-blur-sm rounded-[2rem] overflow-hidden transition-all duration-300 ${showHistory ? 'ring-2 ring-primary/20' : ''}`}>
                                <button
                                    onClick={() => setShowHistory(!showHistory)}
                                    className="w-full p-6 sm:p-8 flex items-center justify-between group text-left"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm transition-all duration-300 ${showHistory ? 'bg-primary text-white rotate-6 scale-110' : 'bg-primary/5 text-primary group-hover:bg-primary/10'}`}>
                                            <Stethoscope className="h-6 w-6" />
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-bold text-foreground">Historique des soins</h3>
                                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">{treatmentGroups.length} traitement{treatmentGroups.length > 1 ? 's' : ''}</p>
                                        </div>
                                    </div>
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center border border-slate-100 transition-all duration-300 ${showHistory ? 'rotate-90 bg-primary/10 border-primary/20' : ''}`}>
                                        <ChevronRight className={`h-5 w-5 ${showHistory ? 'text-primary' : 'text-muted-foreground'}`} />
                                    </div>
                                </button>

                                {showHistory && (
                                    <CardContent className="p-6 pt-0 animate-fade-in">
                                        {/* Filter Tabs */}
                                        <div className="flex p-1 bg-slate-100/80 rounded-xl mb-4">
                                            <button
                                                onClick={() => setTreatmentFilter('all')}
                                                className={`flex-1 py-1.5 text-[10px] font-bold rounded-lg transition-all ${treatmentFilter === 'all' ? 'bg-white text-primary shadow-sm' : 'text-muted-foreground'}`}
                                            >
                                                Tous ({treatmentGroups.length})
                                            </button>
                                            <button
                                                onClick={() => setTreatmentFilter('current')}
                                                className={`flex-1 py-1.5 text-[10px] font-bold rounded-lg transition-all ${treatmentFilter === 'current' ? 'bg-white text-amber-600 shadow-sm' : 'text-muted-foreground'}`}
                                            >
                                                Courants ({treatmentGroups.filter(g => g.remaining > 0).length})
                                            </button>
                                            <button
                                                onClick={() => setTreatmentFilter('completed')}
                                                className={`flex-1 py-1.5 text-[10px] font-bold rounded-lg transition-all ${treatmentFilter === 'completed' ? 'bg-white text-emerald-600 shadow-sm' : 'text-muted-foreground'}`}
                                            >
                                                Soldés ({treatmentGroups.filter(g => g.remaining <= 0).length})
                                            </button>
                                        </div>

                                        <div className="space-y-2">
                                            {filteredTreatmentGroups.length === 0 ? (
                                                <div className="text-center py-8 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                                                    <AlertCircle className="h-5 w-5 text-muted-foreground/30 mx-auto mb-2" />
                                                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">Aucun soin trouvé</p>
                                                </div>
                                            ) : (
                                                filteredTreatmentGroups.map((grp) => {
                                                    const isExpanded = expandedTreatment === grp.treatment;
                                                    const progress = grp.totalAmount > 0 ? Math.round((grp.totalPaid / grp.totalAmount) * 100) : 0;
                                                    const isPaidOff = grp.remaining <= 0;

                                                    return (
                                                        <div key={grp.treatment} className="rounded-xl border border-slate-100 overflow-hidden">
                                                            {/* Collapsed header */}
                                                            <button
                                                                onClick={() => setExpandedTreatment(isExpanded ? null : grp.treatment)}
                                                                className="w-full flex items-center gap-3 p-3.5 hover:bg-slate-50/80 transition-colors text-left"
                                                            >
                                                                <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${isPaidOff ? 'bg-emerald-100' : 'bg-violet-100'}`}>
                                                                    {isPaidOff
                                                                        ? <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                                                                        : <TrendingUp className="h-4 w-4 text-violet-600" />
                                                                    }
                                                                </div>
                                                                <div className="flex-1 min-w-0">
                                                                    <p className="text-sm font-bold text-foreground truncate">{grp.treatment}</p>
                                                                    <div className="flex items-center gap-2 mt-0.5">
                                                                        <span className="text-[10px] text-muted-foreground">{grp.visits.length} séance{grp.visits.length > 1 ? 's' : ''}</span>
                                                                        <span className="text-[10px] text-muted-foreground">•</span>
                                                                        <span className={`text-[10px] font-bold ${isPaidOff ? 'text-emerald-600' : 'text-amber-600'}`}>
                                                                            {isPaidOff ? 'Soldé' : `${grp.remaining.toLocaleString()} DA restant`}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                                <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`} />
                                                            </button>

                                                            {/* Expanded detail */}
                                                            {isExpanded && (
                                                                <div className="px-3.5 pb-3.5 border-t border-slate-50 pt-3 space-y-3 animate-fade-in">
                                                                    {/* Mini progress bar */}
                                                                    <div>
                                                                        <div className="flex justify-between text-[10px] mb-1">
                                                                            <span className="text-muted-foreground">Payé: <strong className="text-emerald-600">{grp.totalPaid.toLocaleString()} DA</strong></span>
                                                                            <span className="text-muted-foreground">Total: <strong>{grp.totalAmount.toLocaleString()} DA</strong></span>
                                                                        </div>
                                                                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                                                            <div
                                                                                className="h-full rounded-full transition-all duration-700"
                                                                                style={{
                                                                                    width: `${Math.min(progress, 100)}%`,
                                                                                    background: isPaidOff ? 'linear-gradient(90deg, #10b981, #059669)' : 'linear-gradient(90deg, #8b5cf6, #6366f1)'
                                                                                }}
                                                                            />
                                                                        </div>
                                                                    </div>

                                                                    {/* Visit list */}
                                                                    {grp.visits.map((v, i) => (
                                                                        <div key={v.id} className="flex items-center gap-2.5 text-xs bg-slate-50/80 rounded-lg p-2.5">
                                                                            <div className="w-6 h-6 rounded-full bg-white border border-slate-200 flex items-center justify-center text-[10px] font-bold text-muted-foreground">
                                                                                {grp.visits.length - i}
                                                                            </div>
                                                                            <div className="flex-1 min-w-0">
                                                                                <p className="text-xs text-foreground font-medium">{formatDate(v.completed_at)}</p>
                                                                                <p className="text-[10px] text-muted-foreground">
                                                                                    Dr. {v.doctor?.name || '—'}
                                                                                </p>
                                                                            </div>
                                                                            <div className="text-right flex-shrink-0">
                                                                                <p className="text-xs font-bold text-emerald-600">+{(v.tranche_paid || 0).toLocaleString()}</p>
                                                                                <p className="text-[10px] text-muted-foreground">/ {(v.total_amount || 0).toLocaleString()}</p>
                                                                            </div>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })
                                            )}
                                        </div>
                                    </CardContent>
                                )}
                            </Card>
                        )}

                        {/* ── Past Appointments (Large Button) ── */}
                        {pastAppointments.length > 0 && (
                            <Card className={`border-0 shadow-lg bg-white/90 backdrop-blur-sm rounded-[2rem] overflow-hidden transition-all duration-300 ${showPastAppts ? 'ring-2 ring-slate-400/20' : ''}`}>
                                <button
                                    onClick={() => setShowPastAppts(!showPastAppts)}
                                    className="w-full p-6 sm:p-8 flex items-center justify-between group text-left"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm transition-all duration-300 ${showPastAppts ? 'bg-slate-500 text-white rotate-6 scale-110' : 'bg-slate-100 text-slate-500 group-hover:bg-slate-200'}`}>
                                            <Clock className="h-6 w-6" />
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-bold text-foreground">Rendez-vous passés</h3>
                                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">{pastAppointments.length} rendez-vous</p>
                                        </div>
                                    </div>
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center border border-slate-100 transition-all duration-300 ${showPastAppts ? 'rotate-90 bg-slate-100 border-slate-200' : ''}`}>
                                        <ChevronRight className={`h-5 w-5 ${showPastAppts ? 'text-slate-600' : 'text-muted-foreground'}`} />
                                    </div>
                                </button>

                                {showPastAppts && (
                                    <CardContent className="p-6 pt-0 animate-fade-in">
                                        <div className="space-y-1.5">
                                            {pastAppointments.slice(0, 10).map((appt) => (
                                                <div key={appt.id} className="flex items-center gap-2.5 p-2.5 rounded-lg bg-slate-50/60">
                                                    <div className="flex-shrink-0 w-10 text-center">
                                                        <p className="text-sm font-bold text-muted-foreground">{formatShortDate(appt.appointment_at)}</p>
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                                                            <Clock className="h-3 w-3" /> {formatTime(appt.appointment_at)}
                                                            {appt.doctor && <span className="ml-1">• Dr. {(appt.doctor as any)?.name}</span>}
                                                        </p>
                                                    </div>
                                                    {getStatusBadge(appt.status)}
                                                </div>
                                            ))}
                                            {pastAppointments.length > 10 && (
                                                <p className="text-[10px] text-center text-muted-foreground pt-1">
                                                    +{pastAppointments.length - 10} autres rendez-vous
                                                </p>
                                            )}
                                        </div>
                                    </CardContent>
                                )}
                            </Card>
                        )}

                        {/* ── New Search Button ── */}
                        <div className="flex justify-center pt-2 pb-4">
                            <Button
                                onClick={handleReset}
                                variant="outline"
                                className="rounded-xl bg-white/60 border-slate-200 hover:bg-white text-muted-foreground font-bold text-xs uppercase tracking-wider"
                            >
                                <ArrowLeft className="h-3.5 w-3.5 mr-2" /> Nouvelle recherche
                            </Button>
                        </div>
                    </div>
                )}

                <FullscreenQrModal
                    open={isQrStickerOpen}
                    onOpenChange={setIsQrStickerOpen}
                    patientName={patientName}
                    patientPhone={phone}
                />
            </div>
        </div>
    );
};

export default PatientCard;
