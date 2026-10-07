import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
    LogOut, Search, MessageSquare, Calendar as CalendarIcon,
    Users, CheckCircle2, XCircle, Clock, History, Plus, Phone, Trash2, Pencil, QrCode, Maximize2, Minimize2
} from 'lucide-react';
import QrStickerModal from '@/components/QrStickerModal';
import QrScannerModal from '@/components/QrScannerModal';
import { format, addHours, isWithinInterval, startOfDay, endOfDay, parseISO, startOfToday, endOfToday } from 'date-fns';
import { fr } from 'date-fns/locale';
import { toast } from 'sonner';

interface CompletedClient {
    id: string;
    client_name: string;
    phone: string;
    client_id: string;
    state: string;
    treatment: string;
    total_amount: number;
    tranche_paid: number;
    completed_at: string;
    doctor_id: string;
    notes?: string;
}

interface Appointment {
    id: string;
    client_phone: string;
    client_name: string;
    doctor_id: string;
    appointment_at: string;
    status: 'scheduled' | 'confirmed' | 'coming' | 'denied' | 'no_answer' | 'attended';
    notes: string;
    duration?: number; // duration in minutes
    doctor?: { name: string; initial: string };
}

interface Doctor {
    id: string;
    name: string;
    initial: string;
}

const TREATMENTS = [
    'Extraction simple',
    'Extraction chirurgicale',
    'Obturation (Plombage)',
    'Traitement de canal',
    'Détartrage & Polissage',
    'Blanchiment dentaire',
    'Prothèse fixe (Couronne)',
    'Prothèse amovible',
    'Implant dentaire',
    'Appareil orthodontique',
    'Consultation dentaire'
];

const Rendezvous = () => {
    const [clients, setClients] = useState<CompletedClient[]>([]);
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [doctors, setDoctors] = useState<Doctor[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [paymentFilter, setPaymentFilter] = useState<'all' | 'paid' | 'unpaid'>('all');
    const [selectedClient, setSelectedClient] = useState<{ phone: string, name: string } | null>(null);
    const [selectedDoctorMobile, setSelectedDoctorMobile] = useState<string>('all');
    const [viewingPatient, setViewingPatient] = useState<{ id?: string; phone: string; name: string } | null>(null);
    const [selectedTreatment, setSelectedTreatment] = useState<string | null>(null);
    const [isScheduleOpen, setIsScheduleOpen] = useState(false);
    const [viewingClient, setViewingClient] = useState<CompletedClient | null>(null);
    const [viewingNote, setViewingNote] = useState<string | null>(null);
    const [isPaymentOpen, setIsPaymentOpen] = useState(false);
    const [quickPaymentAmount, setQuickPaymentAmount] = useState<number>(0);
    const [quickPaymentNote, setQuickPaymentNote] = useState<string>('');
    const [isQrStickerOpen, setIsQrStickerOpen] = useState(false);
    const [showQrScanner, setShowQrScanner] = useState(false);


    // Form state for new appointment
    const [newApptDate, setNewApptDate] = useState<Date | undefined>(new Date());
    const [newApptTime, setNewApptTime] = useState('09:00');
    const [newApptDoctor, setNewApptDoctor] = useState('');
    const [newApptNotes, setNewApptNotes] = useState('');
    const [newApptDuration, setNewApptDuration] = useState(60);
    const [editingApptId, setEditingApptId] = useState<string | null>(null);
    const [apptSearchQuery, setApptSearchQuery] = useState('');
    const [apptStatusFilter, setApptStatusFilter] = useState<'all' | 'pending' | 'accepted' | 'denied'>('all');
    const [isNewPatientForAppt, setIsNewPatientForAppt] = useState(false);
    const [apptNewPatientName, setApptNewPatientName] = useState('');
    const [apptNewPatientPhone, setApptNewPatientPhone] = useState('');
    const { user, userRole, signOut } = useAuth();
    const [editingVisit, setEditingVisit] = useState<CompletedClient | null>(null);
    const [isAddVisitOpen, setIsAddVisitOpen] = useState(false);
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
    const [showAddTreatment, setShowAddTreatment] = useState(false);
    const [showAddAppt, setShowAddAppt] = useState(false);
    const [isBaseInfoOpen, setIsBaseInfoOpen] = useState(false);
    const [isDeletingPatient, setIsDeletingPatient] = useState(false);
    const [isCalendarFullscreen, setIsCalendarFullscreen] = useState(false);
    const [baseInfo, setBaseInfo] = useState({ name: '', phone: '' });
    const [newVisitData, setNewVisitData] = useState<Partial<CompletedClient & { apptDate: Date; apptTime: string; apptDoctor: string; apptNotes: string }>>({
        client_name: '',
        phone: '',
        treatment: '',
        total_amount: 0,
        tranche_paid: 0,
        doctor_id: '',
        notes: '',
        state: 'N',
        apptDate: new Date(),
        apptTime: '09:00',
        apptDoctor: '',
        apptNotes: ''
    });

    const fetchActiveSession = async () => {
        const { data } = await supabase.from('sessions').select('id').eq('is_active', true).limit(1).maybeSingle();
        if (data) setActiveSessionId(data.id);
    };

    const fetchInitialData = async () => {
        setLoading(true);
        try {
            await fetchActiveSession();
            // Fetch Appointments
            const { data: apptsData } = await supabase
                .from('appointments')
                .select('*, doctor:doctors(*)')
                .order('appointment_at', { ascending: true });

            // Fetch Doctors
            const { data: docsData } = await supabase
                .from('doctors')
                .select('*');

            if (apptsData) setAppointments(apptsData as any);
            if (docsData) {
                setDoctors(docsData as any);
                if (docsData.length > 0) {
                    // Pre-select first doctor for new visits to avoid null doctor_id
                    setNewVisitData(prev => ({ ...prev, doctor_id: docsData[0].id, apptDoctor: docsData[0].id }));
                }
            }
        } catch (error) {
            console.error('Error fetching initial data:', error);
            toast.error('Erreur lors du chargement des données');
        } finally {
            setLoading(false);
        }
    };

    const fetchClients = async () => {
        let q = supabase
            .from('completed_clients')
            .select('*');

        if (searchQuery.trim()) {
            q = q.or(`client_name.ilike.%${searchQuery.trim()}%,phone.ilike.%${searchQuery.trim()}%`);
        }

        q = q.order('completed_at', { ascending: false });

        const { data } = await q;
        if (data) setClients(data as any);
    };

    const handleSaveVisit = async (visit: Partial<CompletedClient & { apptDate?: Date; apptTime?: string; apptDoctor?: string; apptNotes?: string }>) => {
        if (!visit.client_name || !visit.phone) {
            toast.error('Le nom et le téléphone sont obligatoires');
            return;
        }

        const isNewEntry = !editingVisit && !visit.id;

        try {
            // 1. Handle Treatment (completed_clients)
            // Always create a record for a new entry to establish the patient in the system
            if (showAddTreatment || editingVisit || isNewEntry) {
                if (!activeSessionId) {
                    toast.error('Aucune séance active. Veuillez ouvrir une séance depuis le Manager.');
                    return;
                }

                const treatmentData: any = {
                    client_name: visit.client_name,
                    phone: visit.phone,
                    treatment: (showAddTreatment || editingVisit) && visit.treatment ? visit.treatment : 'Nouveau Patient',
                    total_amount: Number(visit.total_amount || 0),
                    tranche_paid: Number(visit.tranche_paid || 0),
                    doctor_id: visit.doctor_id || (doctors.length > 0 ? doctors[0].id : null),
                    notes: visit.notes || null,
                    completed_at: visit.completed_at || new Date().toISOString(),
                    state: visit.state || 'N',
                    receptionist_id: user?.id,
                    session_id: activeSessionId,
                    client_id: visit.id ? visit.client_id : (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`)
                };

                let { error } = visit.id
                    ? await supabase.from('completed_clients').update(treatmentData).eq('id', visit.id)
                    : await supabase.from('completed_clients').insert(treatmentData);

                // Fallback for receptionist_id constraint if needed
                if (error && error.code === '23503' && error.message?.includes('receptionist_id')) {
                    treatmentData.receptionist_id = 'a44e7e83-189f-4f82-96d8-b0eeea4ab104';
                    const retry = visit.id
                        ? await supabase.from('completed_clients').update(treatmentData).eq('id', visit.id)
                        : await supabase.from('completed_clients').insert(treatmentData);
                    error = retry.error;
                }

                if (error) throw error;
            }

            // 2. Handle Appointment
            if (showAddAppt && !visit.id) { // Only for new entries, not editing an existing visit
                if (!visit.apptDate || !visit.apptDoctor) {
                    toast.error('Veuillez remplir les détails du rendez-vous');
                    return;
                }

                const [hours, minutes] = (visit.apptTime || '09:00').split(':');
                const appointmentAt = new Date(visit.apptDate);
                appointmentAt.setHours(parseInt(hours), parseInt(minutes), 0, 0);

                const appointmentData = {
                    client_phone: visit.phone,
                    client_name: visit.client_name,
                    doctor_id: visit.apptDoctor,
                    appointment_at: appointmentAt.toISOString(),
                    notes: `[DUR:60] ${visit.apptNotes || ''}`.trim(),
                    status: 'scheduled'
                };

                const { error: apptErr } = await supabase.from('appointments').insert(appointmentData);
                if (apptErr) throw apptErr;
            }

            // Close modals immediately
            setIsAddVisitOpen(false);
            setEditingVisit(null);

            // Re-fetch in parallel
            fetchInitialData();
            fetchClients();

            toast.success('Enregistré avec succès');
        } catch (error: any) {
            console.error('Error saving visit/appt:', error);
            const msg = error.message || error.details || 'Erreur lors de l\'enregistrement';
            toast.error(msg);
        }
    };

    const handleQuickPayment = async (latestEntry: CompletedClient, reste: number) => {
        if (quickPaymentAmount <= 0) {
            toast.error('Le montant doit être supérieur à 0');
            return;
        }

        if (quickPaymentAmount > reste) {
            toast.error(`Le versement (${quickPaymentAmount.toLocaleString()} DZD) ne peut pas dépasser le reste à payer (${reste.toLocaleString()} DZD)`);
            return;
        }

        try {
            const paymentData = {
                client_name: latestEntry.client_name,
                phone: latestEntry.phone,
                treatment: latestEntry.treatment,
                total_amount: latestEntry.total_amount,
                tranche_paid: Number(quickPaymentAmount),
                doctor_id: latestEntry.doctor_id,
                notes: quickPaymentNote || 'Versement sans visite',
                completed_at: new Date().toISOString(),
                state: latestEntry.state,
                receptionist_id: user?.id,
                session_id: activeSessionId,
                client_id: latestEntry.client_id
            };

            const { error } = await supabase.from('completed_clients').insert(paymentData);
            if (error) throw error;

            toast.success('Versement enregistré avec succès');
            setIsPaymentOpen(false);
            setQuickPaymentAmount(0);
            setQuickPaymentNote('');

            fetchInitialData();
            fetchClients();
        } catch (error) {
            console.error('Error saving quick payment:', error);
            toast.error('Erreur lors de l\'enregistrement');
        }
    };

    const handleDeleteVisit = async (visitId: string) => {
        if (!['manager', 'admin'].includes(userRole || '')) {
            toast.error('Seul un administrateur peut supprimer une visite');
            return;
        }
        if (!window.confirm('Voulez-vous vraiment supprimer cette visite ?')) return;

        try {
            const { error } = await supabase
                .from('completed_clients')
                .delete()
                .eq('id', visitId);

            if (error) throw error;

            toast.success('Visite supprimée');
            fetchInitialData();
            fetchClients();
            if (viewingClient && viewingClient.id === visitId) {
                setViewingClient(null);
            }
        } catch (error) {
            console.error('Error deleting visit:', error);
            toast.error('Erreur lors de la suppression');
        }
    };

    const handleUpdateBaseInfo = async () => {
        if (!baseInfo.name || !baseInfo.phone) {
            toast.error('Le nom et le téléphone sont obligatoires');
            return;
        }

        try {
            // Update ALL records with this client's phone to maintain dossier integrity
            const { error } = await supabase
                .from('completed_clients')
                .update({
                    client_name: baseInfo.name,
                    phone: baseInfo.phone
                })
                .eq('client_id', viewingPatient?.id || viewingPatient?.phone);

            if (error) throw error;

            // Also update any appointments with the old phone
            await supabase
                .from('appointments')
                .update({
                    client_name: baseInfo.name,
                    client_phone: baseInfo.phone
                })
                .eq('client_phone', viewingPatient?.phone);

            toast.success('Informations patient mises à jour');
            setIsBaseInfoOpen(false);

            // Update local viewing state if necessary
            if (viewingPatient) {
                setViewingPatient({ id: viewingPatient.id, name: baseInfo.name, phone: baseInfo.phone });
            }

            fetchClients();
            fetchInitialData();
        } catch (error) {
            console.error('Error updating patient info:', error);
            toast.error('Erreur lors de la mise à jour');
        }
    };

    const handleDeletePatient = async () => {
        if (!baseInfo.phone || !baseInfo.name) {
            toast.error('Informations patient manquantes');
            return;
        }

        if (!window.confirm(`Supprimer définitivement le dossier de ${baseInfo.name} ? Cette action supprimera tout l'historique et les rendez-vous.`)) return;

        setIsDeletingPatient(true);
        try {
            // Delete from completed_clients by client_id
            const deleteHistory = supabase
                .from('completed_clients')
                .delete()
                .eq('client_id', viewingPatient?.id || baseInfo.phone);

            // Delete from appointments
            const deleteAppts = supabase
                .from('appointments')
                .delete()
                .eq('client_phone', baseInfo.phone)
                .ilike('client_name', baseInfo.name);

            const [res1, res2] = await Promise.all([deleteHistory, deleteAppts]);

            if (res1.error) throw res1.error;
            if (res2.error) throw res2.error;

            toast.success('Dossier patient supprimé');
            setIsBaseInfoOpen(false);
            setViewingPatient(null);

            // Fast refresh
            fetchClients();
            fetchInitialData();
        } catch (error) {
            console.error('Error deleting patient dossier:', error);
            toast.error('Erreur lors de la suppression');
        } finally {
            setIsDeletingPatient(false);
        }
    };

    const handleDeleteAppointment = async (id: string) => {
        if (!['manager', 'admin'].includes(userRole || '')) {
            toast.error('Seul un administrateur peut supprimer un rendez-vous');
            return;
        }
        if (!window.confirm('Voulez-vous vraiment supprimer ce rendez-vous ?')) return;

        const { error } = await supabase
            .from('appointments')
            .delete()
            .eq('id', id);

        if (error) {
            toast.error('Erreur lors de la suppression');
        } else {
            setAppointments(prev => prev.filter(a => a.id !== id));
            toast.success('Rendez-vous supprimé');
        }
    };

    useEffect(() => {
        fetchInitialData();
        const channel = supabase
            .channel('appointments-changes')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'appointments' },
                () => {
                    fetchInitialData();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    // Fetch clients with server-side debounce for scalability
    useEffect(() => {
        const timeoutId = setTimeout(() => {
            fetchClients();
        }, 300);
        return () => clearTimeout(timeoutId);
    }, [searchQuery]);

    // Escape key to exit fullscreen calendar
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isCalendarFullscreen) setIsCalendarFullscreen(false);
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isCalendarFullscreen]);

    // Deduplication and debt filtering logic
    const uniqueClients = useMemo(() => {
        const patientData = new Map<string, { latest: CompletedClient, totalPaid: number }>();

        clients.forEach(c => {
            const key = `${(c.client_id || c.phone).trim()}_${(c.treatment || '').toLowerCase().trim()}`;
            const existing = patientData.get(key);
            const currentPaid = c.tranche_paid || 0;

            if (!existing) {
                patientData.set(key, { latest: c, totalPaid: currentPaid });
            } else {
                // Keep the record with the most recent completion date as 'latest'
                const isNewer = new Date(c.completed_at) > new Date(existing.latest.completed_at);
                patientData.set(key, { 
                    latest: isNewer ? c : existing.latest,
                    totalPaid: existing.totalPaid + currentPaid
                });
            }
        });

        return Array.from(patientData.values())
            .map(d => ({ ...d.latest, totalPaid: d.totalPaid }))
            .sort((a, b) => a.client_name.localeCompare(b.client_name));
    }, [clients]);

    // Group by patient (client_id strictly or fallback to phone) to build dossier entries with multiple treatments
    const groupedPatients = useMemo(() => {
        const map = new Map<string, { id: string; name: string; phone: string; treatments: Array<{ treatment: string; latest: CompletedClient; totalPaid: number }> }>();
        const patientPhones = new Set<string>();
        
        // 1. Add completed clients
        uniqueClients.forEach(c => {
            const key = (c.client_id || c.phone).trim();
            patientPhones.add(c.phone.trim());
            const existing = map.get(key);
            if (!existing) {
                map.set(key, {
                    id: key,
                    name: c.client_name,
                    phone: c.phone,
                    treatments: [{ treatment: c.treatment || '—', latest: c, totalPaid: (c as any).totalPaid || 0 }]
                });
            } else {
                existing.treatments.push({ treatment: c.treatment || '—', latest: c, totalPaid: (c as any).totalPaid || 0 });
                // If this is a more recent completion date, update the name to the latest name
                const isNewer = new Date(c.completed_at) > new Date(existing.treatments[0]?.latest.completed_at || 0);
                if (isNewer) {
                    existing.name = c.client_name;
                }
            }
        });

        // 2. Add patients from appointments who don't have completed client visits
        const q = searchQuery.toLowerCase().trim();
        appointments.forEach(a => {
            if (q) {
                const nameMatch = a.client_name?.toLowerCase().includes(q);
                const phoneMatch = a.client_phone?.includes(q);
                if (!nameMatch && !phoneMatch) return;
            }

            const key = a.client_phone.trim();
            if (!patientPhones.has(key)) {
                map.set(key, {
                    id: key,
                    name: a.client_name,
                    phone: a.client_phone,
                    treatments: []
                });
                patientPhones.add(key);
            }
        });

        return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
    }, [uniqueClients, appointments, searchQuery]);

    const filteredGroupedPatients = useMemo(() => {
        if (paymentFilter === 'all') return groupedPatients;

        return groupedPatients.filter(patient => {
            const allTreatmentsPaid = patient.treatments.length > 0 && patient.treatments.every(t => t.totalPaid >= t.latest.total_amount);
            const hasUnpaidTreatment = patient.treatments.some(t => t.totalPaid < t.latest.total_amount);

            if (paymentFilter === 'paid') return allTreatmentsPaid;
            if (paymentFilter === 'unpaid') return hasUnpaidTreatment;
            return true;
        });
    }, [groupedPatients, paymentFilter]);

    const filteredClients = uniqueClients; // keep for other uses

    // Combine completed clients and appointments to get a list of all unique patients for suggestion autocomplete
    const uniquePatients = useMemo(() => {
        const patientsMap = new Map<string, { client_name: string; phone: string }>();

        // 1. Add from completed clients
        clients.forEach(c => {
            const key = c.phone.trim();
            if (!patientsMap.has(key)) {
                patientsMap.set(key, {
                    client_name: c.client_name,
                    phone: c.phone
                });
            }
        });

        // 2. Add from appointments
        appointments.forEach(a => {
            const key = a.client_phone.trim();
            if (!patientsMap.has(key)) {
                patientsMap.set(key, {
                    client_name: a.client_name,
                    phone: a.client_phone
                });
            }
        });

        return Array.from(patientsMap.values()).sort((a, b) => a.client_name.localeCompare(b.client_name));
    }, [clients, appointments]);

    const filteredSuggestions = useMemo(() => {
        if (!apptSearchQuery.trim()) return [];
        const q = apptSearchQuery.toLowerCase();
        return uniquePatients.filter(c =>
            c.client_name.toLowerCase().includes(q) ||
            c.phone.includes(q)
        ).slice(0, 5);
    }, [apptSearchQuery, uniquePatients]);

    const parsedAppointments = useMemo(() => {
        return appointments.map(a => ({
            ...a,
            startOfDayTime: startOfDay(parseISO(a.appointment_at)).getTime()
        }));
    }, [appointments]);

    const upcomingAppointments = useMemo(() => {
        const now = new Date();
        const next24h = addHours(now, 24);
        return parsedAppointments.filter(a => {
            const apptDate = parseISO(a.appointment_at);
            const isWithin24h = isWithinInterval(apptDate, { start: now, end: next24h });

            const matchesStatus =
                apptStatusFilter === 'all' ||
                (apptStatusFilter === 'accepted' && a.status === 'coming') || // Usually 'coming' is for people in queue, but user wants to hide them
                (apptStatusFilter === 'denied' && a.status === 'denied') ||
                (apptStatusFilter === 'pending' && (a.status === 'scheduled' || a.status === 'confirmed'));

            // Filter out 'attended' status completely from upcoming view
            return isWithin24h && matchesStatus && a.status !== 'attended';
        });
    }, [parsedAppointments, apptStatusFilter]);

    const totalApptsForDay = useMemo(() => {
        if (!newApptDate) return 0;
        const dayStart = startOfDay(newApptDate).getTime();
        return parsedAppointments.filter(a =>
            a.startOfDayTime === dayStart &&
            a.status !== 'denied' &&
            a.status !== 'attended'
        ).length;
    }, [newApptDate, parsedAppointments]);

    const handleUpdateStatus = async (id: string, status: Appointment['status']) => {
        const { error } = await supabase
            .from('appointments')
            .update({ status })
            .eq('id', id);

        if (error) {
            toast.error('Erreur lors de la mise à jour');
        } else {
            setAppointments(prev => prev.map(a => a.id === id ? { ...a, status } : a));
            toast.success('Statut mis à jour');
        }
    };

    const handleSendSMS = (phone: string, name: string, time: string) => {
        const message = `Clinique PasseVite : votre rendez-vous avec notre docteur est dans 24h. Merci de confirmer votre présence.`;
        window.open(`sms:${phone}?body=${encodeURIComponent(message)}`, '_blank');
    };

    const handleSendWhatsApp = (phone: string, name: string, time: string) => {
        const message = `Clinique PasseVite : votre rendez-vous avec notre docteur est dans 24h. Merci de confirmer votre présence.`;
        const normalizePhoneForWhatsApp = (p: string) => {
            let digits = (p || '').replace(/\D/g, '');
            if (!digits) return '';
            // Strip leading international 00 or +
            if (digits.startsWith('00')) digits = digits.replace(/^00/, '');
            // If it still starts with 0, assume local format and prepend Algeria country code '213'
            if (digits.startsWith('0')) {
                digits = '213' + digits.slice(1);
            }
            return digits;
        };

        const digits = normalizePhoneForWhatsApp(phone);
        if (!digits) {
            toast.error('Numéro WhatsApp invalide');
            return;
        }

        const waUrl = `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
        window.open(waUrl, '_blank');
    };

    const handleCall = (phone: string) => {
        window.open(`tel:${phone}`, '_self');
    };

    const getStatusStyle = (status: Appointment['status']) => {
        switch (status) {
            case 'coming': return 'bg-emerald-500 hover:bg-emerald-600 text-white border-emerald-500';
            case 'denied': return 'bg-rose-500 hover:bg-rose-600 text-white border-rose-500';
            case 'scheduled': return 'bg-slate-100 text-slate-700 border-slate-200';
            case 'attended': return 'bg-blue-500 hover:bg-blue-600 text-white border-blue-500';
            default: return 'bg-slate-100 text-slate-700 border-slate-200';
        }
    };

    const handleScheduleAppt = async () => {
        let clientName = '';
        let clientPhone = '';

        if (isNewPatientForAppt) {
            if (!apptNewPatientName || !apptNewPatientPhone) {
                toast.error('Veuillez remplir le nom et le téléphone');
                return;
            }
            clientName = apptNewPatientName;
            clientPhone = apptNewPatientPhone;
        } else {
            if (!selectedClient) {
                toast.error('Veuillez sélectionner un patient');
                return;
            }
            clientName = selectedClient.name;
            clientPhone = selectedClient.phone;
        }

        if (!newApptDate || !newApptDoctor) {
            toast.error('Veuillez remplir la date et le médecin');
            return;
        }

        const [hours, minutes] = newApptTime.split(':');
        const h = parseInt(hours);
        const m = parseInt(minutes);

        if (h < 7 || h > 22 || (h === 22 && m > 0)) {
            toast.error('Les horaires sont limités de 07:00 à 22:00');
            return;
        }

        const appointmentAt = new Date(newApptDate);
        appointmentAt.setHours(h, m, 0, 0);

        const finalNotes = `[DUR:${newApptDuration}] ${newApptNotes.trim()}`;

        if (editingApptId) {
            const { error } = await supabase
                .from('appointments')
                .update({
                    client_name: clientName,
                    client_phone: clientPhone,
                    doctor_id: newApptDoctor,
                    appointment_at: appointmentAt.toISOString(),
                    notes: finalNotes
                })
                .eq('id', editingApptId);

            if (error) toast.error('Erreur lors de la modification');
            else {
                toast.success('Rendez-vous modifié');
                setIsScheduleOpen(false);
                fetchInitialData();
            }
        } else {
            const { error } = await supabase
                .from('appointments')
                .insert({
                    client_name: clientName,
                    client_phone: clientPhone,
                    doctor_id: newApptDoctor,
                    appointment_at: appointmentAt.toISOString(),
                    status: 'scheduled',
                    notes: finalNotes
                });

            if (error) toast.error("Erreur lors de l'enregistrement");
            else {
                toast.success('Rendez-vous programmé');
                setIsScheduleOpen(false);
                fetchInitialData();
            }
        }
    };

    const openEditModal = (appt: Appointment) => {
        setEditingApptId(appt.id);
        const date = parseISO(appt.appointment_at);
        setNewApptDate(date);
        setNewApptTime(format(date, 'HH:mm'));
        setNewApptDoctor(appt.doctor_id);

        // Parse duration from notes if it exists in format [DUR:X]
        const durMatch = appt.notes?.match(/\[DUR:(\d+)\]/);
        if (durMatch) {
            setNewApptDuration(parseInt(durMatch[1]));
            setNewApptNotes(appt.notes.replace(/\[DUR:\d+\]\s*/, ''));
        } else {
            setNewApptDuration(60);
            setNewApptNotes(appt.notes || '');
        }

        setSelectedClient({ phone: appt.client_phone, name: appt.client_name });
        setIsScheduleOpen(true);
    };

    const handleEmptySlotClick = (e: React.MouseEvent<HTMLDivElement>, doctorId: string) => {
        // Only trigger if clicking directly on the column background
        if (e.target !== e.currentTarget) return;

        const rect = e.currentTarget.getBoundingClientRect();
        const offsetY = e.clientY - rect.top;

        // Each 30 mins is 60px. Each hour is 120px. 
        // 0px -> 07:00, 60px -> 07:30, etc.
        const totalMinutes = Math.max(0, Math.floor(offsetY / 60) * 30);
        const hour = 7 + Math.floor(totalMinutes / 60);
        const minute = totalMinutes % 60;

        // Limit to 22:00
        if (hour >= 22 && minute > 0) return;

        const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;

        setNewApptTime(timeString);
        setNewApptDoctor(doctorId);
        setEditingApptId(null);
        setSelectedClient(null);
        setNewApptNotes('');
        setIsScheduleOpen(true);
    };

    const getClientHistory = (phone: string, treatment: string) => {
        const history = clients.filter(c =>
            c.phone === phone &&
            (c.treatment || '').toLowerCase().trim() === treatment.toLowerCase().trim()
        );
        const appts = appointments.filter(a => a.client_phone === phone);
        return { history, appts };
    };

    const getPatientTreatments = (clientId: string) => {
        const entries = clients.filter(c => (c.client_id || c.phone) === clientId);
        const patientPhone = entries.find(e => e.phone)?.phone || clientId;
        const map = new Map<string, { entries: CompletedClient[]; totalPaid: number; latestTotal: number; latestTs: number }>();
        entries.forEach(e => {
            const key = e.treatment || '—';
            const existing = map.get(key) || { entries: [], totalPaid: 0, latestTotal: 0, latestTs: 0 };
            existing.entries.push(e);
            existing.totalPaid += e.tranche_paid || 0;
            const ts = new Date(e.completed_at).getTime();
            // keep latest total_amount
            if (ts > existing.latestTs) {
                existing.latestTotal = e.total_amount || 0;
                existing.latestTs = ts;
            }
            map.set(key, existing);
        });

        const treatments = Array.from(map.entries()).map(([t, v]) => ({ treatment: t, entries: v.entries.sort((a, b) => new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime()), totalPaid: v.totalPaid, latestTotal: v.latestTotal }));

        const apptsById = new Map<string, Appointment>();
        appointments.forEach(a => apptsById.set(a.id, a));

        const getApptsForTreatment = (treatment: string) => {
            const ids = new Set((map.get(treatment)?.entries || []).map(e => (e as any).appointment_id).filter(Boolean));
            const result: Appointment[] = [];
            ids.forEach(id => {
                const a = apptsById.get(id as string);
                if (a) result.push(a);
            });
            // fallback: also include appointments matching phone
            if (result.length === 0) {
                return appointments.filter(a => a.client_phone === patientPhone);
            }
            return result;
        };

        return { treatments, getApptsForTreatment };
    };

    return (
        <div className="min-h-screen bg-background flex flex-col">
            <header className="flex items-center justify-between p-4 border-b sticky top-0 bg-background/80 backdrop-blur-md z-20">
                <div className="flex items-center gap-3">
                    <div className="bg-primary/10 p-2 rounded-xl">
                        <CalendarIcon className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-primary italic">Rendez-vous</h1>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Gestion du cabinet</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" asChild className="h-9 w-9">
                        <Link to="/accueil">
                            <Users className="h-5 w-5" />
                        </Link>
                    </Button>
                </div>
            </header>

            {/* Mobile Search Bar removed as requested */}

            <main className="p-4 flex-1 space-y-6">
                <Tabs defaultValue="upcoming" className="w-full">
                    <TabsList className="grid w-full grid-cols-2 bg-muted/50 p-1 rounded-xl h-12">
                        <TabsTrigger value="upcoming" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">
                            <Clock className="h-4 w-4 mr-2" /> À venir
                        </TabsTrigger>
                        <TabsTrigger value="calendar" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">
                            <CalendarIcon className="h-4 w-4 mr-2" /> Calendrier
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="upcoming" className="mt-6 animate-in fade-in slide-in-from-bottom-2">
                        <div className="grid gap-4">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-1">
                                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Prochaines 24 Heures</h2>

                                <div className="flex gap-1.5 p-1 bg-muted/40 rounded-full w-fit">
                                    <Button
                                        variant={apptStatusFilter === 'all' ? "secondary" : "ghost"}
                                        size="sm"
                                        className="rounded-full text-[10px] h-7 px-3 uppercase font-bold"
                                        onClick={() => setApptStatusFilter('all')}
                                    >
                                        Tous
                                    </Button>
                                    <Button
                                        variant={apptStatusFilter === 'pending' ? "secondary" : "ghost"}
                                        size="sm"
                                        className="rounded-full text-[10px] h-7 px-3 uppercase font-bold"
                                        onClick={() => setApptStatusFilter('pending')}
                                    >
                                        Attente
                                    </Button>
                                    <Button
                                        variant={apptStatusFilter === 'accepted' ? "secondary" : "ghost"}
                                        size="sm"
                                        className="rounded-full text-[10px] h-7 px-3 uppercase font-bold text-emerald-600 hover:text-emerald-700"
                                        onClick={() => setApptStatusFilter('accepted')}
                                    >
                                        Venues
                                    </Button>
                                    <Button
                                        variant={apptStatusFilter === 'denied' ? "secondary" : "ghost"}
                                        size="sm"
                                        className="rounded-full text-[10px] h-7 px-3 uppercase font-bold text-rose-600 hover:text-rose-700"
                                        onClick={() => setApptStatusFilter('denied')}
                                    >
                                        Refusés
                                    </Button>
                                </div>
                            </div>

                            {loading ? (
                                <div className="h-32 flex items-center justify-center border rounded-xl border-dashed">
                                    <div className="animate-spin h-5 w-5 border-2 border-primary border-t-transparent rounded-full" />
                                </div>
                            ) : upcomingAppointments.length === 0 ? (
                                <Card className="border-dashed shadow-none">
                                    <CardContent className="flex flex-col items-center justify-center p-12 text-center">
                                        <CalendarIcon className="h-10 w-10 text-muted-foreground/20 mb-4" />
                                        <p className="text-muted-foreground font-medium">Aucun rendez-vous prévu pour les prochaines 24h</p>
                                    </CardContent>
                                </Card>
                            ) : (
                                upcomingAppointments.map(appt => (
                                    <Card
                                        key={appt.id}
                                        className={cn(
                                            "overflow-hidden border-none shadow-premium cursor-pointer hover:shadow-lg transition-all",
                                            appt.status === 'coming' ? "bg-emerald-50/80 dark:bg-emerald-900/10 shadow-emerald-100" :
                                                appt.status === 'denied' ? "bg-rose-50/80 dark:bg-rose-900/10 shadow-rose-100" :
                                                    "bg-gradient-to-br from-white to-slate-50 dark:from-white/5 dark:to-transparent"
                                        )}
                                        onClick={() => openEditModal(appt)}
                                    >
                                        <CardContent className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                            <div className="flex gap-4">
                                                <div className="bg-primary/5 p-3 rounded-2xl flex flex-col items-center justify-center min-w-[70px] h-[70px]">
                                                    <span className="text-[10px] uppercase font-bold text-primary/60">{format(parseISO(appt.appointment_at), 'EEE', { locale: fr })}</span>
                                                    <span className="text-xl font-black text-primary">{format(parseISO(appt.appointment_at), 'HH:mm')}</span>
                                                </div>
                                                <div>
                                                    <p className="font-bold text-lg text-foreground">{appt.client_name}</p>
                                                    <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                                                        {appt.doctor?.name || 'Inconnu'}
                                                    </p>
                                                    <div className="mt-2 flex gap-1.5">
                                                        <Badge variant="outline" className={`capitalize text-[10px] px-2 py-0 ${getStatusStyle(appt.status)}`}>
                                                            {appt.status}
                                                        </Badge>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2">
                                                <Button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleSendSMS(appt.client_phone, appt.client_name, format(parseISO(appt.appointment_at), 'HH:mm'));
                                                    }}
                                                    variant="secondary" className="flex-1 sm:flex-none h-10 gap-2 bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-400"
                                                >
                                                    <MessageSquare className="h-4 w-4" />
                                                    <span className="text-sm">SMS</span>
                                                </Button>
                                                <Button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleSendWhatsApp(appt.client_phone, appt.client_name, format(parseISO(appt.appointment_at), 'HH:mm'));
                                                    }}
                                                    variant="secondary" className="flex-1 sm:flex-none h-10 gap-2 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400"
                                                >
                                                    <MessageSquare className="h-4 w-4" />
                                                    <span className="text-sm">WhatsApp</span>
                                                </Button>
                                                <Button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleCall(appt.client_phone);
                                                    }}
                                                    variant="secondary" className="flex-1 sm:flex-none h-10 gap-2 bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-400"
                                                >
                                                    <Phone className="h-4 w-4" />
                                                    <span className="text-sm">Appel</span>
                                                </Button>
                                                {(appt.status === 'scheduled' || appt.status === 'confirmed') && (
                                                    <div className="flex gap-1 flex-1 sm:flex-none" onClick={(e) => e.stopPropagation()}>
                                                        <Button
                                                            onClick={() => handleUpdateStatus(appt.id, 'coming')}
                                                            size="icon" variant="outline" className="h-10 w-10 text-emerald-600 hover:text-white hover:bg-emerald-600 border-emerald-100"
                                                            title="Vient"
                                                        >
                                                            <CheckCircle2 className="h-5 w-5" />
                                                        </Button>
                                                        <Button
                                                            onClick={() => handleUpdateStatus(appt.id, 'denied')}
                                                            size="icon" variant="outline" className="h-10 w-10 text-rose-600 hover:text-white hover:bg-rose-600 border-rose-100"
                                                            title="Refusé"
                                                        >
                                                            <XCircle className="h-5 w-5" />
                                                        </Button>
                                                    </div>
                                                )}
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))
                            )}
                        </div>
                    </TabsContent>

                    <TabsContent value="calendar" className="mt-6 animate-in fade-in slide-in-from-bottom-2">
                        <div className="flex flex-col lg:flex-row gap-6">
                            {/* Date Selector & Summary - Above on Mobile, Right on Desktop */}
                            <div className="w-full lg:w-[300px] space-y-6 lg:order-2 shrink-0">
                                <Card className="border-none shadow-premium overflow-hidden">
                                    <CardHeader className="p-4 pb-2">
                                        <CardTitle className="text-sm font-bold truncate">Sélecteur de Date</CardTitle>
                                    </CardHeader>
                                    <CardContent className="p-2 flex justify-center">
                                        <Calendar
                                            mode="single"
                                            selected={newApptDate}
                                            onSelect={setNewApptDate}
                                            className="rounded-xl border-none"
                                            locale={fr}
                                        />
                                    </CardContent>
                                </Card>

                                <Card className="border-none shadow-premium bg-primary text-primary-foreground p-5 rounded-2xl">
                                    <h4 className="font-black italic text-lg mb-2">Résumé du jour</h4>
                                    <div className="space-y-4">
                                        <div className="flex justify-between items-center text-primary-foreground/80">
                                            <span className="text-sm">Total RDV</span>
                                            <span className="text-xl font-black">
                                                {parsedAppointments.filter(a => a.startOfDayTime === startOfDay(newApptDate || new Date()).getTime()).length}
                                            </span>
                                        </div>
                                        <div className="h-px bg-white/20" />
                                        <p className="text-[10px] uppercase font-bold text-white/60 tracking-widest">Aujourd'hui {format(new Date(), 'PP', { locale: fr })}</p>
                                    </div>
                                </Card>
                            </div>

                            {/* Main Calendar View */}
                            <Card
                                className={`flex-1 border-none shadow-premium overflow-hidden lg:order-1 min-w-0 transition-all duration-300 ${isCalendarFullscreen ? 'fixed inset-0 z-50 rounded-none m-0 bg-background' : ''
                                    }`}
                                onDoubleClick={() => setIsCalendarFullscreen(prev => !prev)}
                            >
                                <CardContent className="p-0 h-full flex flex-col">
                                    <div className="p-4 border-b bg-muted/10 flex items-center justify-between gap-4">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-primary/5 rounded-xl">
                                                <Users className="h-5 w-5 text-primary" />
                                            </div>
                                            <div>
                                                <h3 className="font-black italic text-base sm:text-xl text-primary leading-tight">Vue Docteur</h3>
                                                <div className="flex items-center gap-2">
                                                    <p className="text-[10px] sm:text-xs text-muted-foreground uppercase font-bold tracking-widest opacity-60">Agenda Global</p>
                                                    <span className="text-muted-foreground/30 px-1">•</span>
                                                    <p className="text-[10px] sm:text-xs text-primary font-black uppercase tracking-widest">{totalApptsForDay} RDV</p>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Popover>
                                                <PopoverTrigger asChild>
                                                    <Button variant="outline" className="h-9 px-3 text-xs rounded-xl gap-2 border-primary/20 hover:bg-primary/5 bg-white/50">
                                                        <CalendarIcon className="h-3.5 w-3.5 text-primary" />
                                                        <span className="hidden xs:inline">{newApptDate ? format(newApptDate, 'dd/MM/yy', { locale: fr }) : 'Date'}</span>
                                                    </Button>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-auto p-0 border-none shadow-2xl" align="end">
                                                    <Calendar
                                                        mode="single"
                                                        selected={newApptDate || new Date()}
                                                        onSelect={(d) => d && setNewApptDate(d)}
                                                        locale={fr}
                                                        initialFocus
                                                    />
                                                </PopoverContent>
                                            </Popover>
                                            <Button
                                                variant="outline"
                                                size="icon"
                                                className="h-9 w-9 rounded-xl sm:hidden flex"
                                                onClick={() => setIsCalendarFullscreen(!isCalendarFullscreen)}
                                            >
                                                {isCalendarFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                                            </Button>
                                            <Button variant="outline" className="h-9 px-3 text-xs rounded-xl hidden sm:flex" onClick={() => setNewApptDate(new Date())}>Aujourd'hui</Button>
                                        </div>
                                    </div>



                                    <div className="p-0 sm:p-2 flex-1 overflow-hidden relative">
                                        <div className={`overflow-auto scrollbar-thin scrollbar-thumb-primary/10 ${isCalendarFullscreen ? 'h-[calc(100vh-100px)] sm:h-[calc(100vh-140px)]' : 'h-[650px] sm:h-[600px]'} px-2 sm:px-4 custom-scrollbar`}>
                                            <div className="relative min-h-[1050px] w-fit min-w-full">

                                                {/* Time Background Grid Lines */}
                                                <div className="absolute inset-0 pt-10 pointer-events-none">
                                                    {[
                                                        '07:00', '07:30', '08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '12:00', '12:30',
                                                        '13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00', '17:30', '18:00', '18:30',
                                                        '19:00', '19:30', '20:00', '20:30', '21:00', '21:30', '22:00'
                                                    ].map((t, idx) => (
                                                        <div
                                                            key={t}
                                                            className={`absolute left-0 w-full border-t flex items-start ${t.endsWith(':00') ? 'border-muted' : 'border-muted/20 border-dashed'}`}
                                                            style={{ top: `${idx * 60 + 50}px` }}
                                                        >
                                                            <span className={`text-[9px] font-black -mt-2.5 bg-background pr-2 z-10 uppercase tracking-tighter ${t.endsWith(':00') ? 'text-muted-foreground/50' : 'text-muted-foreground/20'}`}>
                                                                {t}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>

                                                {/* Current Time Indicator */}
                                                {newApptDate && format(newApptDate, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd') && (
                                                    <div
                                                        className="absolute left-0 right-0 border-t-2 border-rose-500/50 z-30 pointer-events-none flex items-center"
                                                        style={{
                                                            top: `${(new Date().getHours() - 7) * 120 + (new Date().getMinutes() / 60) * 120 + 50}px`,
                                                            transition: 'top 60s linear'
                                                        }}
                                                    >
                                                        <div className="w-2 h-2 rounded-full bg-rose-500 -ml-1 shadow-[0_0_10px_rgba(244,63,94,0.5)]" />
                                                        <div className="ml-2 px-1.5 py-0.5 rounded bg-rose-500 text-[8px] font-black text-white uppercase tracking-widest shadow-lg">Maintenant</div>
                                                    </div>
                                                )}

                                                {/* Doctor Columns */}
                                                <div className="ml-8 flex sm:grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 min-h-full pb-10">
                                                    {doctors.map(doctor => (
                                                        <div key={doctor.id} className="relative min-h-[2000px] w-[280px] shrink-0 sm:shrink sm:w-auto rounded-2xl bg-muted/5 border border-primary/5 overflow-hidden group/col">
                                                            {/* Column Sticky Header */}
                                                            <div className="sticky top-0 z-10 bg-white/80 dark:bg-black/40 backdrop-blur-md p-3 border-b border-primary/5 text-center group-hover/col:bg-primary/5 transition-colors">
                                                                <p className="text-[10px] text-primary font-black uppercase tracking-[0.2em] mb-0.5 opacity-60">Cabinet</p>
                                                                <p className="font-black text-sm text-foreground italic flex items-center justify-center gap-2">
                                                                    <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                                                                    {doctor.name}
                                                                </p>
                                                            </div>

                                                            {/* Appointments for this doctor */}
                                                            <div
                                                                className="relative h-full pt-10 cursor-crosshair"
                                                                onClick={(e) => handleEmptySlotClick(e, doctor.id)}
                                                            >
                                                                {(() => {
                                                                    const dayStart = startOfDay(newApptDate || new Date()).getTime();
                                                                    const filteredAppts = parsedAppointments.filter(a =>
                                                                        a.status !== 'denied' &&
                                                                        a.status !== 'attended' &&
                                                                        a.doctor_id === doctor.id &&
                                                                        a.startOfDayTime === dayStart
                                                                    );

                                                                    // Group by hour
                                                                    const hourGroups: Record<number, any[]> = {};
                                                                    filteredAppts.forEach(a => {
                                                                        const h = parseISO(a.appointment_at).getHours();
                                                                        if (!hourGroups[h]) hourGroups[h] = [];
                                                                        hourGroups[h].push(a);
                                                                    });

                                                                    return filteredAppts.map(appt => {
                                                                        const date = parseISO(appt.appointment_at);
                                                                        const h = date.getHours();
                                                                        const m = date.getMinutes();
                                                                        const offset = (h - 7) * 120 + (m / 60) * 120;

                                                                        const group = hourGroups[h] || [];
                                                                        const index = group.findIndex(a => a.id === appt.id);
                                                                        const total = group.length;
                                                                        const isOverlapping = total > 1;

                                                                        // Extract duration from notes
                                                                        const durMatch = appt.notes?.match(/\[DUR:(\d+)\]/);
                                                                        const duration = durMatch ? parseInt(durMatch[1]) : 60;
                                                                        const displayNotes = appt.notes?.replace(/\[DUR:\d+\]\s*/, '') || 'Sans note';
                                                                        const cardHeight = (duration / 60) * 120 - 10;

                                                                        return (
                                                                            <div
                                                                                key={appt.id}
                                                                                className={`
                                                                                        absolute p-3 rounded-2xl border-l-[6px] 
                                                                                        shadow-xl shadow-primary/5 transition-all duration-300 
                                                                                        hover:scale-[1.02] active:scale-95 z-20 cursor-pointer group
                                                                                        bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm border border-primary/5
                                                                                        ${isOverlapping ? (index === 0 ? 'left-2 w-[calc(50%-12px)]' : 'right-2 w-[calc(50%-12px)]') : 'left-2 right-2'}
                                                                                        ${appt.status === 'coming' ? 'border-l-emerald-500 shadow-emerald-500/10' :
                                                                                        appt.status === 'denied' ? 'border-l-rose-500 shadow-rose-500/10' :
                                                                                            appt.status === 'attended' ? 'border-l-blue-500 shadow-blue-500/10 opacity-75' :
                                                                                                'border-l-primary shadow-primary/10'}
                                                                                    `}
                                                                                style={{ top: `${offset}px`, height: `${cardHeight}px` }}
                                                                                onClick={() => openEditModal(appt)}
                                                                            >
                                                                                <div className="flex justify-between items-start mb-1">
                                                                                    <span className={`text-[11px] font-black tracking-tighter italic ${appt.status === 'coming' ? 'text-emerald-600' : appt.status === 'denied' ? 'text-rose-600' : 'text-primary'}`}>
                                                                                        {format(date, 'HH:mm')}
                                                                                    </span>
                                                                                    <div className={`w-1.5 h-1.5 rounded-full ${appt.status === 'coming' ? 'bg-emerald-500 animate-pulse' : 'bg-primary/20'}`} />
                                                                                </div>
                                                                                <p className="text-xs font-black text-foreground truncate uppercase tracking-tight">
                                                                                    {appt.client_name}
                                                                                </p>
                                                                                <p className="text-[9px] text-muted-foreground font-bold mt-0.5 truncate flex items-center gap-1">
                                                                                    <span className="w-1 h-1 rounded-full bg-muted-foreground/30" />
                                                                                    {displayNotes}
                                                                                </p>
                                                                            </div>
                                                                        );
                                                                    });
                                                                })()}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </TabsContent>
                </Tabs>
            </main>

            {/* Global Scheduling Modal */}
            <Dialog open={isScheduleOpen} onOpenChange={(open) => {
                setIsScheduleOpen(open);
                if (!open) {
                    setEditingApptId(null);
                    setNewApptNotes('');
                    setApptSearchQuery('');
                    setIsNewPatientForAppt(false);
                    setApptNewPatientName('');
                    setApptNewPatientPhone('');
                }
            }}>
                <DialogContent className="sm:rounded-2xl max-w-md">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-bold italic">
                            {editingApptId ? 'Modifier le Rendez-vous' : 'Programmer un Rendez-vous'}
                        </DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        {!editingApptId && (
                            <div className="flex gap-2 p-1 bg-muted rounded-xl mb-4">
                                <Button
                                    variant={!isNewPatientForAppt ? "secondary" : "ghost"}
                                    className="flex-1 h-9 rounded-lg text-xs font-bold transition-all"
                                    onClick={() => setIsNewPatientForAppt(false)}
                                >
                                    Patient Existant
                                </Button>
                                <Button
                                    variant={isNewPatientForAppt ? "secondary" : "ghost"}
                                    className="flex-1 h-9 rounded-lg text-xs font-bold transition-all"
                                    onClick={() => setIsNewPatientForAppt(true)}
                                >
                                    Nouveau Patient
                                </Button>
                            </div>
                        )}

                        {!isNewPatientForAppt ? (
                            <div className="space-y-4">
                                {!selectedClient ? (
                                    <div className="space-y-2">
                                        <label className="text-xs font-black uppercase text-muted-foreground">Rechercher</label>
                                        <div className="relative">
                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                            <Input
                                                placeholder="Nom ou téléphone..."
                                                className="pl-10 h-11 rounded-xl"
                                                value={apptSearchQuery}
                                                onChange={(e) => setApptSearchQuery(e.target.value)}
                                            />
                                            {filteredSuggestions.length > 0 && (
                                                <div className="absolute z-50 w-full mt-1 bg-background border rounded-xl shadow-lg overflow-hidden animate-in fade-in slide-in-from-top-1">
                                                    {filteredSuggestions.map(c => (
                                                        <button
                                                            key={c.phone}
                                                            className="w-full text-left px-4 py-2 hover:bg-muted transition-colors border-b last:border-b-0 space-y-0.5"
                                                            onClick={() => {
                                                                setSelectedClient({ phone: c.phone, name: c.client_name });
                                                                setApptSearchQuery('');
                                                            }}
                                                        >
                                                            <p className="text-sm font-bold text-foreground">{c.client_name}</p>
                                                            <p className="text-[10px] text-muted-foreground">{c.phone}</p>
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                        <p className="text-[10px] text-muted-foreground italic">Sélectionnez un patient existant pour pré-remplir ses coordonnées.</p>
                                    </div>
                                ) : (
                                    <div className="bg-muted/30 p-3 rounded-xl border border-dashed text-center relative group">
                                        <div className="mr-auto text-left">
                                            <p className="text-xs font-black uppercase text-muted-foreground/60 mb-1">Patient Sélectionné</p>
                                            <p className="font-bold">{selectedClient.name}</p>
                                            <p className="text-xs text-muted-foreground">{selectedClient.phone}</p>
                                        </div>
                                        {!editingApptId && (
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="absolute top-2 right-2 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                                                onClick={() => setSelectedClient(null)}
                                            >
                                                <XCircle className="h-4 w-4 text-muted-foreground" />
                                            </Button>
                                        )}
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="space-y-4 animate-in fade-in slide-in-from-top-1">
                                <div className="space-y-2">
                                    <label className="text-xs font-black uppercase text-muted-foreground">Nom du Patient</label>
                                    <Input
                                        placeholder="Nom complet"
                                        value={apptNewPatientName}
                                        onChange={e => setApptNewPatientName(e.target.value)}
                                        className="h-11 rounded-xl"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-black uppercase text-muted-foreground">Téléphone</label>
                                    <Input
                                        placeholder="05XX XX XX XX"
                                        value={apptNewPatientPhone}
                                        onChange={e => setApptNewPatientPhone(e.target.value)}
                                        className="h-11 rounded-xl"
                                    />
                                </div>
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-xs font-black uppercase text-muted-foreground">Date</label>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button variant="outline" className="w-full justify-start text-left font-normal h-11 rounded-xl">
                                            <CalendarIcon className="mr-2 h-4 w-4" />
                                            {newApptDate ? format(newApptDate, 'PP', { locale: fr }) : <span>Choisir...</span>}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0 border-none shadow-2xl rounded-2xl" align="start">
                                        <Calendar mode="single" selected={newApptDate} onSelect={(d) => { setNewApptDate(d); }} locale={fr} />
                                    </PopoverContent>
                                </Popover>
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-black uppercase text-muted-foreground">Heure</label>
                                <Input type="time" min="07:00" max="22:00" value={newApptTime} onChange={(e) => setNewApptTime(e.target.value)} className="h-11 rounded-xl" />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-xs font-black uppercase text-muted-foreground">Docteur</label>
                                <Select value={newApptDoctor} onValueChange={setNewApptDoctor}>
                                    <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Docteur" /></SelectTrigger>
                                    <SelectContent>
                                        {doctors.map(d => (
                                            <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-black uppercase text-muted-foreground">Durée</label>
                                <Select value={newApptDuration.toString()} onValueChange={(v) => setNewApptDuration(parseInt(v))}>
                                    <SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="15">15 min</SelectItem>
                                        <SelectItem value="30">30 min</SelectItem>
                                        <SelectItem value="45">45 min</SelectItem>
                                        <SelectItem value="60">1 heure</SelectItem>
                                        <SelectItem value="90">1h 30m</SelectItem>
                                        <SelectItem value="120">2 heures</SelectItem>
                                        <SelectItem value="150">2h 30m</SelectItem>
                                        <SelectItem value="180">3 heures</SelectItem>
                                        <SelectItem value="240">4 heures</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-black uppercase text-muted-foreground">Notes</label>
                            <Input placeholder="Motif du rendez-vous..." value={newApptNotes} onChange={(e) => setNewApptNotes(e.target.value)} className="h-11 rounded-xl" />
                        </div>
                    </div>

                    <DialogFooter className="gap-2">
                        <Button variant="outline" onClick={() => setIsScheduleOpen(false)} className="rounded-xl h-11 flex-1">Annuler</Button>
                        <Button onClick={handleScheduleAppt} className="rounded-xl h-11 flex-1 bg-primary">
                            {editingApptId ? 'Enregistrer' : 'Confirmer'}
                        </Button>
                        {editingApptId && ['manager', 'admin'].includes(userRole || '') && (
                            <Button variant="destructive" onClick={() => handleDeleteAppointment(editingApptId)} className="rounded-xl h-11 px-3">
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isBaseInfoOpen} onOpenChange={setIsBaseInfoOpen}>
                <DialogContent className="max-w-md w-[95vw] rounded-2xl p-6 space-y-6">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-bold italic text-primary">Modifier Identité Patient</DialogTitle>
                        <DialogDescription>Mettre à jour le nom et le numéro de téléphone pour tout le dossier.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-[10px] uppercase font-black text-muted-foreground">Nom Complet</label>
                            <Input
                                value={baseInfo.name}
                                onChange={e => setBaseInfo({ ...baseInfo, name: e.target.value })}
                                placeholder="Nom du patient"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] uppercase font-black text-muted-foreground">Téléphone</label>
                            <Input
                                value={baseInfo.phone}
                                onChange={e => setBaseInfo({ ...baseInfo, phone: e.target.value })}
                                placeholder="05XX XX XX XX"
                            />
                        </div>
                    </div>
                    <DialogFooter className="gap-2 sm:flex-row flex-col">
                        <Button className="flex-1 h-11 rounded-xl font-bold order-1 sm:order-2" onClick={handleUpdateBaseInfo}>Enregistrer les modifications</Button>
                        {['manager', 'admin'].includes(userRole || '') && (
                            <Button
                                variant="destructive"
                                className="sm:w-11 h-11 rounded-xl order-2 sm:order-1"
                                onClick={handleDeletePatient}
                                disabled={isDeletingPatient}
                            >
                                {isDeletingPatient ? (
                                    <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                                ) : (
                                    <Trash2 className="h-4 w-4" />
                                )}
                            </Button>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={!!viewingNote} onOpenChange={(open) => !open && setViewingNote(null)}>
                <DialogContent className="max-w-sm w-[90vw] rounded-2xl p-6 shadow-2xl border-none">
                    <DialogHeader className="pb-4 border-b border-border/10">
                        <DialogTitle className="text-xl font-bold italic text-primary flex items-center gap-2">
                            <MessageSquare className="h-5 w-5" /> Note Complète
                        </DialogTitle>
                    </DialogHeader>
                    <div className="py-6">
                        <div className="p-4 bg-muted/40 rounded-2xl border border-border/50 shadow-inner">
                            <p className="text-sm leading-relaxed text-foreground whitespace-pre-wrap font-medium">{viewingNote}</p>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button onClick={() => setViewingNote(null)} className="w-full h-11 rounded-xl font-bold shadow-premium">
                            Fermer
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <QrScannerModal
                open={showQrScanner}
                onOpenChange={setShowQrScanner}
                onScanResult={(phone, name) => {
                    setViewingPatient({ id: phone, phone, name });
                    setSelectedTreatment(null);
                    setShowQrScanner(false);
                    toast.success(`Dossier patient ouvert : ${name || phone}`);
                }}
            />


            <footer className="p-4 border-t bg-muted/20 text-center">
                <p className="text-[10px] text-muted-foreground uppercase tracking-widest">&copy; PasseVite - Gestion Holistique des Soins</p>
            </footer>
        </div>
    );
};

export default Rendezvous;
