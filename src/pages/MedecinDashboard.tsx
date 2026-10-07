import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Calendar } from '@/components/ui/calendar';
import {
    Search, LogOut, Calendar as CalendarIcon, FileText,
    Users, TrendingUp, Plus, Clock, History,
    PieChart, DollarSign, Activity, FileDown, Edit3,
    X, Printer, ClipboardList, CheckCircle2, ChevronRight,
    LayoutDashboard, MapPin, Phone, ArrowUpRight, User, Trash2,
    Calendar as CalIcon, MessageSquare, XCircle, UserCheck, Pill
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format, parseISO, startOfToday, endOfToday, startOfDay } from 'date-fns';
import { fr } from 'date-fns/locale';
import { toast } from 'sonner';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useQueue, QueueEntry } from '@/hooks/useQueue';
import { cn } from '@/lib/utils';
import { DentalChart } from '@/components/DentalChart';
import { Checkbox } from '@/components/ui/checkbox';

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

const COMMON_MEDICATIONS: Record<string, any> = {
    'Paracetamol 500mg': { dosage: '1 comprimé', duree: '3 jours', frequency_count: 3, timing: 'apres' },
    'Paracetamol 1g': { dosage: '1 comprimé', duree: '3 jours', frequency_count: 3, timing: 'apres' },
    'Amoxicilline 1g': { dosage: '1 comprimé', duree: '7 jours', frequency_count: 2, timing: 'apres' },
    'Augmentin 1g': { dosage: '1 sachet/cp', duree: '7 jours', frequency_count: 2, timing: 'apres' },
    'Spifen 400mg': { dosage: '1 comprimé', duree: '3 jours', frequency_count: 3, timing: 'apres' },
    'Flagyl 500mg': { dosage: '1 comprimé', duree: '5 jours', frequency_count: 3, timing: 'apres' },
    'Kétoprofène': { dosage: '1 comprimé', duree: '5 jours', frequency_count: 2, timing: 'apres' },
    'Bain de bouche': { dosage: '1 mesure', duree: '10 jours', frequency_count: 3, timing: 'apres' },
    'Doliprane 1g': { dosage: '1 comprimé', duree: '3 jours', frequency_count: 3, timing: 'apres' },
    'Clamoxyl 1g': { dosage: '1 comprimé', duree: '7 jours', frequency_count: 2, timing: 'apres' }
};

const MedecinDashboard = () => {
    const navigate = useNavigate();
    const { user, signOut } = useAuth();
    const { entries, inCabinetEntries, completeClient, handoffConsultation, returnToQueue, doctors, callClient } = useQueue();
    const queryClient = useQueryClient();

    // LOGGED IN DOCTOR INFO
    const [doctorInfo, setDoctorInfo] = useState<{ id: string, name: string } | null>(null);

    useEffect(() => {
        const authData = localStorage.getItem('doctor_auth');
        if (authData) {
            setDoctorInfo(JSON.parse(authData));
        } else {
            navigate('/doctor/login');
        }
    }, [navigate]);

    // DASHBOARD DATA
    const [prescriptions, setPrescriptions] = useState<any[]>([]);
    const [appointments, setAppointments] = useState<any[]>([]);
    const [patients, setPatients] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    // CALENDAR STATE
    const [calendarDate, setCalendarDate] = useState<Date | undefined>(new Date());
    const [isCalendarFullscreen, setIsCalendarFullscreen] = useState(false);
    const parsedAppointments = useMemo(() => {
        return appointments.map(a => ({
            ...a,
            startOfDayTime: startOfDay(parseISO(a.appointment_at)).getTime()
        }));
    }, [appointments]);

    // FILTERS & SEARCH
    const [searchOrdonnance, setSearchOrdonnance] = useState('');
    const [searchPatient, setSearchPatient] = useState('');
    const [patientFilter, setPatientFilter] = useState('all');

    // SELECTED PATIENT FOR FICHE MALADE
    const [selectedPatient, setSelectedPatient] = useState<any>(null);
    const [isPatientDialogOpen, setIsPatientDialogOpen] = useState(false);
    const [viewingNote, setViewingNote] = useState<string | null>(null);
    const [viewingOrdonnance, setViewingOrdonnance] = useState<any | null>(null);

    // ORDONNANCE MODAL STATE
    const [showOrdonnanceModal, setShowOrdonnanceModal] = useState(false);
    const [savingOrdonnance, setSavingOrdonnance] = useState(false);
    const [dbMedications, setDbMedications] = useState<any[]>([]);
    const [ordonnanceForm, setOrdonnanceForm] = useState({
        patient_name: '',
        age: '',
        date: format(new Date(), 'yyyy-MM-dd'),
        medications: [{ name: '', dosage: '', duree: '', frequency_count: 1, frequency_unit: 'comprimé(s)', timing: 'apres', instructions: '' }],
        notes: ''
    });

    // Patient picker state for "Ajouter au patient"
    const [showPatientPicker, setShowPatientPicker] = useState(false);
    const [patientQuery, setPatientQuery] = useState('');
    const [patientResults, setPatientResults] = useState<any[]>([]);
    const [patientLoading, setPatientLoading] = useState(false);

    // NEW MEDICATION MODAL STATE
    const [showNewMedModal, setShowNewMedModal] = useState(false);
    const [creatingMed, setCreatingMed] = useState(false);
    const [newMedForm, setNewMedForm] = useState({
        name: '',
        default_dosage: '',
        default_duration: '',
        default_frequency_count: 1,
        default_frequency_unit: 'comprimé(s)',
        default_timing: 'apres'
    });

    const [templates, setTemplates] = useState<any[]>(() => {
        const saved = localStorage.getItem('ordonnance_templates');
        return saved ? JSON.parse(saved) : [];
    });

    // COMPLETE MODAL STATE (from Accueil.tsx)
    const [showCompleteModal, setShowCompleteModal] = useState(false);
    const [selectedEntry, setSelectedEntry] = useState<QueueEntry | null>(null);
    const [clientName, setClientName] = useState('');
    const [ecNotes, setEcNotes] = useState('');

    const [showQueueDialog, setShowQueueDialog] = useState(false);

    const doctorEntries = useMemo(() => {
        if (!doctorInfo) return [];
        return entries.filter(e => e.doctor_id === doctorInfo.id);
    }, [entries, doctorInfo]);

    const activeCabinetEntries = useMemo(() => {
        if (!doctorInfo) return [];
        return inCabinetEntries.filter(e => e.doctor_id === doctorInfo.id && e.status === 'in_cabinet');
    }, [inCabinetEntries, doctorInfo]);

    const handleCallPatient = async (entry: QueueEntry) => {
        const activeDoctorEntry = inCabinetEntries.find(e => e.doctor_id === entry.doctor_id && e.status === 'in_cabinet');
        if (activeDoctorEntry) {
            const activeName = activeDoctorEntry.patient_name || activeDoctorEntry.phone;
            toast.error(`Vous avez déjà un patient au cabinet (${activeName}).`);
            return;
        }

        const { error } = await callClient(entry.id);
        if (error) {
            toast.error("Erreur lors de l'appel du patient");
        } else {
            toast.success(`Patient ${entry.patient_name || entry.phone} appelé au cabinet`);
            setShowQueueDialog(false);
        }
    };

    // Multi-act state
    const [selectedActs, setSelectedActs] = useState<{ name: string; price: number }[]>([]);
    const [isAddActOpen, setIsAddActOpen] = useState(false);
    const [newActName, setNewActName] = useState('');
    const [newActPrice, setNewActPrice] = useState('');
    const [showAddActSuggestions, setShowAddActSuggestions] = useState(false);

    // Dental Chart state
    const [selectedTeeth, setSelectedTeeth] = useState<number[]>([]);

    const toggleTooth = (num: number) => {
        setSelectedTeeth(prev => prev.includes(num) ? prev.filter(n => n !== num) : [...prev, num]);
    };

    const addAct = () => {
        if (!newActName || !newActPrice) return;
        const price = parseFloat(newActPrice) || 0;
        const newActs = [...selectedActs, { name: newActName, price }];
        setSelectedActs(newActs);

        // Update combined fields
        const combinedTreatment = newActs.map(a => a.name).join(' + ');
        setTreatment(combinedTreatment);
        const total = newActs.reduce((sum, a) => sum + a.price, 0);
        setTotalAmount(total.toString());

        // Reset and close
        setNewActName('');
        setNewActPrice('');
        setIsAddActOpen(false);
    };

    const removeAct = (index: number) => {
        const newActs = selectedActs.filter((_, i) => i !== index);
        setSelectedActs(newActs);
        setTreatment(newActs.map(a => a.name).join(' + '));
        const total = newActs.reduce((sum, a) => sum + a.price, 0);
        setTotalAmount(total.toString());
    };
    const [treatment, setTreatment] = useState('');
    const [totalAmount, setTotalAmount] = useState('');
    const [tranchePaid, setTranchePaid] = useState('');
    const [totalPaidPreviously, setTotalPaidPreviously] = useState(0);
    const [completeNotes, setCompleteNotes] = useState('');
    const [historyTreatments, setHistoryTreatments] = useState<Array<{ treatment: string; totalAmount: number; totalPaid: number }>>([]);
    const [selectedHistoryTreatment, setSelectedHistoryTreatment] = useState<string | null>(null);
    const [isCompletingClient, setIsCompletingClient] = useState(false);

    const [hasNextAppt, setHasNextAppt] = useState(false);
    const [nextApptDate, setNextApptDate] = useState<Date | undefined>(undefined);
    const [nextApptTime, setNextApptTime] = useState('09:00');
    const [nextApptDoctorId, setNextApptDoctorId] = useState('');
    const [nextApptNote, setNextApptNote] = useState('');

    const [treatmentsList, setTreatmentsList] = useState<string[]>(TREATMENTS);
    const [showTreatmentSuggestions, setShowTreatmentSuggestions] = useState(false);

    const saveAsTemplate = () => {
        if (!ordonnanceForm.medications.some(m => m.name)) {
            toast.error('Ajoutez au moins un médicament pour créer un modèle');
            return;
        }

        const templateName = prompt('Nom du modèle ?', 'Modèle - ' + ordonnanceForm.medications[0].name);
        if (!templateName) return;

        const newTemplate = {
            id: Date.now(),
            name: templateName,
            medications: ordonnanceForm.medications,
            notes: ordonnanceForm.notes
        };

        const updated = [newTemplate, ...templates];
        setTemplates(updated);
        localStorage.setItem('ordonnance_templates', JSON.stringify(updated));
        toast.success('Modèle sauvegardé');
    };

    const loadTemplate = (template: any) => {
        setOrdonnanceForm({
            patient_name: '',
            date: format(new Date(), 'yyyy-MM-dd'),
            age: '',
            medications: template.medications,
            notes: template.notes || ''
        });
        toast.success(`Modèle "${template.name}" chargé`);
    };

    const deleteTemplate = (id: number) => {
        const updated = templates.filter(t => t.id !== id);
        setTemplates(updated);
        localStorage.setItem('ordonnance_templates', JSON.stringify(updated));
    };


    // Fetch Patient History (Appointments & Ordonnances)
    const { data: patientHistory, isLoading: isLoadingHistory } = useQuery({
        queryKey: ['patient-history', selectedPatient?.phone, selectedPatient?.client_name],
        enabled: !!selectedPatient,
        queryFn: async () => {
            const [appts, ords] = await Promise.all([
                supabase.from('appointments').select('*, doctor:doctors(*)').eq('client_phone', selectedPatient.phone).order('appointment_at', { ascending: false }),
                supabase.from('prescriptions').select('*').eq('patient_name', selectedPatient.client_name).order('prescription_date', { ascending: false })
            ]);
            return { appointments: appts.data || [], ordonnances: ords.data || [] };
        }
    });

    const fetchDashboardData = useCallback(async () => {
        if (!doctorInfo) return;
        setLoading(true);
        try {
            const { data: rxData } = await supabase
                .from('prescriptions')
                .select('*')
                .eq('doctor_id', doctorInfo.id)
                .order('prescription_date', { ascending: false });
            if (rxData) setPrescriptions(rxData);

            const { data: aptData } = await supabase
                .from('appointments')
                .select('*')
                .eq('doctor_id', doctorInfo.id)
                .order('appointment_at', { ascending: false });
            if (aptData) setAppointments(aptData);

            const { data: clientData } = await supabase
                .from('completed_clients')
                .select('*')
                .eq('doctor_id', doctorInfo.id)
                .order('completed_at', { ascending: false });
            if (clientData) setPatients(clientData);

            const { data: medData } = await supabase
                .from('medications')
                .select('*')
                .order('name');
            if (medData) setDbMedications(medData);

        } catch (error) {
            console.error('Error fetching dashboard data:', error);
            toast.error('Erreur lors du chargement des données');
        } finally {
            setLoading(false);
        }
    }, [doctorInfo]);

    useEffect(() => {
        if (doctorInfo) {
            fetchDashboardData();
        }
    }, [doctorInfo, fetchDashboardData]);

    // Realtime subscriptions for live updates
    useEffect(() => {
        if (!doctorInfo) return;

        const channel = supabase
            .channel('doctor-dashboard-updates')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, () => fetchDashboardData())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'completed_clients' }, () => fetchDashboardData())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'prescriptions' }, () => fetchDashboardData())
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [doctorInfo, fetchDashboardData]);

    // AUTO-SELECT CABINET PATIENT
    useEffect(() => {
        // If we have patients but none selected, or the selected one is no longer in cabinet
        if (activeCabinetEntries.length > 0) {
            const currentActive = activeCabinetEntries[0];
            if (!selectedEntry || !activeCabinetEntries.find(e => e.id === selectedEntry.id)) {
                handleCompleteClick(currentActive);
            }
        } else if (selectedEntry && !activeCabinetEntries.find(e => e.id === selectedEntry.id)) {
            // Selected patient is gone from cabinet
            setSelectedEntry(null);
        }
    }, [activeCabinetEntries, selectedEntry]);

    const handleCreateMedication = async () => {
        if (!newMedForm.name) {
            toast.error('Veuillez entrer le nom du médicament');
            return;
        }

        setCreatingMed(true);
        try {
            // We only save the name because the current database schema only contains 'id' and 'name'
            const { error } = await supabase.from('medications').insert([{
                name: newMedForm.name
            }]);
            if (error) throw error;
            toast.success('Médicament ajouté au catalogue');
            setShowNewMedModal(false);
            setNewMedForm({
                name: '',
                default_dosage: '',
                default_duration: '',
                default_frequency_count: 1,
                default_frequency_unit: 'comprimé(s)',
                default_timing: 'apres'
            });
            fetchDashboardData();
        } catch (err: any) {
            toast.error('Erreur: ' + err.message);
            console.error('Database Error:', err);
        } finally {
            setCreatingMed(false);
        }
    };

    const handleSaveOrdonnance = async () => {
        if (!doctorInfo) return;
        if (!ordonnanceForm.patient_name || ordonnanceForm.medications.some(m => !m.name)) {
            toast.error('Veuillez remplir le nom du patient et au moins un médicament');
            return;
        }

        setSavingOrdonnance(true);
        try {
            const { error } = await supabase.from('prescriptions').insert([{
                doctor_id: doctorInfo.id,
                patient_name: ordonnanceForm.patient_name,
                prescription_date: ordonnanceForm.date || format(new Date(), 'yyyy-MM-dd'),
                medications: ordonnanceForm.medications as any,
                notes: ordonnanceForm.notes,
                age: ordonnanceForm.age ? parseInt(ordonnanceForm.age) : null
            }]);

            if (error) throw error;

            toast.success('Ordonnance créée');
            setShowOrdonnanceModal(false);
            setOrdonnanceForm({
                patient_name: '',
                age: '',
                date: format(new Date(), 'yyyy-MM-dd'),
                medications: [{ name: '', dosage: '', duree: '', frequency_count: 1, frequency_unit: 'comprimé(s)', timing: 'apres', instructions: '' }],
                notes: ''
            });
            fetchDashboardData();
            queryClient.invalidateQueries({ queryKey: ['patient-history'] });
        } catch (err: any) {
            toast.error('Erreur: ' + err.message);
        } finally {
            setSavingOrdonnance(false);
        }
    };

    // Patient picker helpers
    const searchPatients = async (q: string) => {
        if (!doctorInfo) return;
        const trimmed = q.trim();
        if (!trimmed) { setPatientResults([]); return; }
        setPatientLoading(true);
        try {
            const orQuery = `phone.eq.${trimmed},client_name.ilike.%${trimmed}%`;
            const { data } = await supabase
                .from('completed_clients')
                .select('*')
                .or(orQuery)
                .eq('doctor_id', doctorInfo.id)
                .limit(20);
            setPatientResults(data || []);
        } catch (err) {
            console.error(err);
            toast.error('Erreur recherche patients');
        } finally {
            setPatientLoading(false);
        }
    };

    const addToPatient = async (patient: any) => {
        if (!doctorInfo) return;
        setSavingOrdonnance(true);
        try {
            const { error } = await supabase.from('prescriptions').insert([{
                doctor_id: doctorInfo.id,
                patient_name: patient.client_name,
                prescription_date: ordonnanceForm.date || format(new Date(), 'yyyy-MM-dd'),
                medications: ordonnanceForm.medications as any,
                notes: ordonnanceForm.notes,
                age: ordonnanceForm.age ? parseInt(ordonnanceForm.age) : null
            }]);
            if (error) throw error;
            toast.success('Ordonnance ajoutée au dossier patient');
            setShowPatientPicker(false);
            setShowOrdonnanceModal(false);
            setOrdonnanceForm({
                patient_name: '',
                age: '',
                date: format(new Date(), 'yyyy-MM-dd'),
                medications: [{ name: '', dosage: '', duree: '', frequency_count: 1, frequency_unit: 'comprimé(s)', timing: 'apres', instructions: '' }],
                notes: ''
            });
            fetchDashboardData();
            queryClient.invalidateQueries({ queryKey: ['patient-history'] });
        } catch (err: any) {
            console.error(err);
            toast.error('Erreur: ' + err?.message || 'Impossible d\'ajouter');
        } finally {
            setSavingOrdonnance(false);
        }
    };

    const handleCompleteClick = async (entry: QueueEntry) => {
        setSelectedEntry(entry);
        setClientName(entry.patient_name || '');

        try {
            if (entry.state === 'R') {
                const { data: history } = await supabase
                    .from('completed_clients')
                    .select('*')
                    .eq('phone', entry.phone)
                    .order('completed_at', { ascending: false });

                if (history && history.length > 0) {
                    const map = new Map<string, { totalPaid: number; totalAmount: number; lastDate: number }>();
                    history.forEach((item: any) => {
                        const key = item.treatment || '—';
                        const existing = map.get(key) || { totalPaid: 0, totalAmount: 0, lastDate: 0 };
                        existing.totalPaid += (item.tranche_paid || 0);
                        const ts = new Date(item.completed_at).getTime();
                        if (!existing.lastDate || ts > existing.lastDate) {
                            existing.totalAmount = item.total_amount || 0;
                            existing.lastDate = ts;
                        }
                        map.set(key, existing);
                    });

                    const treatmentsArr = Array.from(map.entries()).map(([treatment, v]) => ({
                        treatment,
                        totalAmount: v.totalAmount || 0,
                        totalPaid: v.totalPaid || 0,
                    }));

                    setHistoryTreatments(treatmentsArr);
                    const first = treatmentsArr[0];
                    if (first) {
                        setTreatment(first.treatment);
                        setTotalAmount(first.totalAmount?.toString() || '');
                        setTotalPaidPreviously(first.totalPaid || 0);
                        setSelectedHistoryTreatment(first.treatment);
                    } else {
                        setTreatment('');
                        setTotalAmount('');
                        setTotalPaidPreviously(0);
                        setSelectedHistoryTreatment(null);
                    }
                    setTranchePaid('');
                } else {
                    setHistoryTreatments([]);
                    setTreatment('');
                    setTotalAmount('');
                    setTotalPaidPreviously(0);
                    setTranchePaid('');
                    setSelectedHistoryTreatment(null);
                }
            } else {
                setHistoryTreatments([]);
                setTreatment('');
                setTotalAmount('');
                setTotalPaidPreviously(0);
                setTranchePaid('');
                setSelectedHistoryTreatment(null);
            }
        } catch (err) {
            console.error('Error fetching history:', err);
            setHistoryTreatments([]);
            setTreatment('');
            setTotalAmount('');
            setTotalPaidPreviously(0);
            setTranchePaid('');
            setSelectedHistoryTreatment(null);
        }

        setCompleteNotes('');
        setHasNextAppt(false);
        setNextApptDate(undefined);
        setNextApptTime('09:00');
        setNextApptDoctorId(entry.doctor_id);
        setNextApptNote('');
        setSelectedActs([]); // Reset multi-act list
        setSelectedTeeth([]); // Reset selected teeth
    };

    const handleComplete = async () => {
        if (!selectedEntry || !treatment || !totalAmount) {
            toast.error('Veuillez définir le traitement et le montant');
            return;
        }
        if (isCompletingClient) return;

        setIsCompletingClient(true);

        try {
            const { error } = await handoffConsultation(
                selectedEntry.id,
                {
                    treatment,
                    total_amount: parseFloat(totalAmount) || 0,
                    handoff_notes: completeNotes
                }
            );

            if (error) {
                console.error('Handoff error:', error);
                toast.error('Erreur de transmission : ' + (error as any).message);
                return;
            }

            toast.success(`Patient ${selectedEntry.patient_name} prêt pour l'accueil.`);

            // Clear current selection and refresh
            setSelectedEntry(null);
            setTreatment('');
            setTotalAmount('');
            setCompleteNotes('');
            fetchDashboardData();
        } catch (error) {
            console.error('Error in handleComplete:', error);
            toast.error('Erreur lors de la confirmation');
        } finally {
            setIsCompletingClient(false);
        }
    };

    const handlePrintOrdonnance = (rx: any) => {
        const printWindow = window.open('', '_blank');
        if (!printWindow) return;

        const medsHtml = rx.medications.map((m: any) => {
            const timingMap: Record<string, string> = {
                'avant': 'avant le repas',
                'apres': 'après le repas',
                'pendant': 'pendant le repas',
                'soir': 'le soir',
                'à jeun': 'à jeun'
            };
            const hTiming = timingMap[m.timing] || m.timing || '';

            return `
            <div style="margin-bottom: 5mm; font-family: 'Lato', sans-serif; break-inside: avoid;">
                <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 1mm;">
                    <span style="font-size: 13pt; font-weight: 700; color: #000; text-transform: uppercase;">
                        ${m.name}${m.frequency_unit ? ` (${m.frequency_unit.replace('(s)', '')})` : ''}
                    </span>
                    <span style="font-size: 10pt; font-weight: 400; color: #2a8bbf;">Qsp: ${m.duree || m.duration || '--'}</span>
                </div>
                <div style="font-size: 12pt; color: #333; font-weight: 400; padding-left: 4mm; line-height: 1.4; font-style: italic;">
                    ${m.dosage ? `${m.dosage} ` : ''}${m.frequency_count ? `${m.frequency_count} fois par jour ${hTiming}` : (m.instructions || '')}
                </div>
            </div>
        `;
        }).join('');

        printWindow.document.write(`
<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>Ordonnance — ${rx.patient_name}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400&family=Lato:wght@300;400;700&display=swap');
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { background: transparent; font-family: 'Lato', sans-serif; overflow: hidden; }
  .page { width: 210mm; height: 297mm; background: #fff; padding: 10mm 15mm; display: flex; flex-direction: column; margin: 0 auto; position: relative; overflow: hidden; }
  
  /* WATERMARK */
  .watermark { 
    position: absolute; 
    top: 50%; 
    left: 50%; 
    transform: translate(-50%, -50%) rotate(-15deg); 
    opacity: 0.04; 
    z-index: 0; 
    width: 150mm; 
    pointer-events: none;
  }

  .clinic-brand { text-align: center; font-family: 'Playfair Display', serif; font-size: 28pt; font-weight: 700; color: #3a9fd1; margin-bottom: 8mm; letter-spacing: 0.1em; text-transform: uppercase; z-index: 10; position: relative; }
  .top-row { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 5mm; border-bottom: 1px solid #f0f7fb; padding-bottom: 3mm; z-index: 10; position: relative; }
  .clinic-info { flex: 1; }
  .clinic-name { font-size: 14pt; font-weight: 700; color: #2a8bbf; margin-bottom: 1mm; }
  .doctor-title { font-size: 11pt; font-weight: 700; color: #2a8bbf; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 2mm; }
  .clinic-address { font-size: 9pt; font-weight: 300; color: #5ab0d8; line-height: 1.4; }
  .clinic-phone { font-size: 9pt; color: #2a8bbf; font-weight: 400; margin-top: 1mm; }
  .patient-fields { display: flex; flex-direction: column; gap: 3mm; min-width: 70mm; }
  .field-line { display: flex; align-items: baseline; gap: 6px; white-space: nowrap; }
  .field-label { font-weight: 700; font-size: 11pt; color: #2a8bbf; }
  .field-dots { flex: 1; min-width: 40mm; margin-bottom: 2px; padding-left: 3mm; font-size: 11pt; color: #333; font-weight: 400; }
  .ordonnance-title { text-align: center; font-size: 16pt; font-weight: 700; color: #1a6fa0; letter-spacing: 0.2em; text-decoration: underline; text-underline-offset: 5px; margin: 8mm 0 10mm 0; z-index: 10; position: relative; }
  .body-area { flex: 1; overflow: hidden; padding: 0 5mm; z-index: 10; position: relative; }
  @media print { body { background: white; } .page { margin: 0; box-shadow: none; } @page { size: A4; margin: 0; } }
</style>
</head>
<body>
<div class="page">
  <img src="/VitalWeb.png" class="watermark" alt="" />
  <div class="clinic-brand">CLINIQUE PASSEVITE</div>
  <div class="top-row">
    <div class="clinic-info">
      <div class="clinic-name">${doctorInfo?.name || 'Dr. Hakim'}</div>
      <div class="doctor-title">Chirurgien Dentiste</div>
      <div class="clinic-address">Cite 08mai 1945, bt17a<br>Bab Ezzouar<br>Alger</div>
      <div class="clinic-phone">0554 02 97 32</div>
    </div>
    <div class="patient-fields">
      <div class="field-line"><span class="field-label">Le :</span><span class="field-dots">${format(new Date(rx.prescription_date), 'dd MMMM yyyy', { locale: fr })}</span></div>
      <div class="field-line"><span class="field-label">Nom :</span><span class="field-dots">${rx.patient_name}</span></div>
      <div class="field-line"><span class="field-label">Age :</span><span class="field-dots">${rx.age || '--'} ans</span></div>
    </div>
  </div>
  <div class="ordonnance-title">ORDONNANCE</div>
  <div class="body-area">${medsHtml}${rx.notes ? `<div style="margin-top: 8mm; font-size: 10pt; color: #666; font-style: italic;">Note : ${rx.notes}</div>` : ''}</div>
</div>
<script>window.onload = () => { window.print(); setTimeout(() => { window.close(); }, 500); };</script>
</body>
</html>
        `);
        printWindow.document.close();
    };

    const addMedicationToForm = () => {
        setOrdonnanceForm({
            ...ordonnanceForm,
            medications: [...ordonnanceForm.medications, { name: '', dosage: '', duree: '', frequency_count: 1, frequency_unit: 'comprimé(s)', timing: 'apres', instructions: '' }]
        });
    };

    const removeMedicationFromForm = (idx: number) => {
        if (ordonnanceForm.medications.length <= 1) return;
        const newMeds = [...ordonnanceForm.medications];
        newMeds.splice(idx, 1);
        setOrdonnanceForm({ ...ordonnanceForm, medications: newMeds });
    };

    const updateMedicationInForm = (idx: number, field: string, value: any) => {
        setOrdonnanceForm(prev => ({
            ...prev,
            medications: prev.medications.map((m, i) =>
                i === idx ? { ...m, [field]: value } : m
            )
        }));
    };

    // Escape key to exit fullscreen calendar
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isCalendarFullscreen) setIsCalendarFullscreen(false);
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isCalendarFullscreen]);

    const handleSignOut = async () => {
        await signOut();
        toast.success('Déconnecté avec succès');
        navigate('/');
    };

    // FILTERED DATA
    const filteredPrescriptions = useMemo(() => {
        return prescriptions.filter(rx =>
            rx.patient_name.toLowerCase().includes(searchOrdonnance.toLowerCase()) ||
            JSON.stringify(rx.medications).toLowerCase().includes(searchOrdonnance.toLowerCase())
        );
    }, [prescriptions, searchOrdonnance]);

    const filteredPatientsList = useMemo(() => {
        return patients.filter(p => {
            const matchesSearch = p.client_name.toLowerCase().includes(searchPatient.toLowerCase()) || p.phone.includes(searchPatient);
            const matchesStatus = patientFilter === 'all' || (patientFilter === 'completed' ? p.state === 'fully_treated' : p.state !== 'fully_treated');
            return matchesSearch && matchesStatus;
        });
    }, [patients, searchPatient, patientFilter]);

    // ANALYTICS CALCULATIONS
    const [selectedRevenueDate, setSelectedRevenueDate] = useState(format(new Date(), 'yyyy-MM-dd'));

    const filteredPaymentsByDate = useMemo(() => {
        const targetDate = new Date(selectedRevenueDate);
        targetDate.setHours(0, 0, 0, 0);
        const targetEnd = new Date(selectedRevenueDate);
        targetEnd.setHours(23, 59, 59, 999);

        return patients.filter(p => {
            const pDate = new Date(p.completed_at);
            return pDate >= targetDate && pDate <= targetEnd;
        });
    }, [patients, selectedRevenueDate]);

    const selectedDayRevenue = useMemo(() => {
        return filteredPaymentsByDate.reduce((acc, p) => acc + (p.tranche_paid || 0), 0);
    }, [filteredPaymentsByDate]);

    const monthlyData = useMemo(() => {
        const last6Months = Array.from({ length: 6 }).map((_, i) => {
            const date = new Date();
            date.setMonth(date.getMonth() - (5 - i));
            return format(date, 'MMM', { locale: fr });
        });

        const revenuePerMonth = last6Months.map(month => {
            const total = patients.reduce((acc, p) => {
                const pMonth = format(new Date(p.completed_at), 'MMM', { locale: fr });
                return pMonth === month ? acc + (p.tranche_paid || 0) : acc;
            }, 0);
            return { month, revenue: total };
        });

        return revenuePerMonth;
    }, [patients]);


    return (
        <div className="min-h-screen bg-background flex flex-col">
            {/* Header following RendezVous.tsx style */}
            <header className="flex items-center justify-between p-4 border-b sticky top-0 bg-background/80 backdrop-blur-md z-20">
                <div className="flex items-center gap-3">
                    <div className="bg-primary/10 p-2 rounded-xl">
                        <Users className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-foreground italic">PasseVite Docteur</h1>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Tableau de bord de soins</p>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <div className="hidden lg:flex flex-col text-right">
                        <span className="text-sm font-bold text-slate-700">{doctorInfo ? doctorInfo.name : 'Chargement...'}</span>
                        <p className="text-[10px] text-muted-foreground uppercase font-medium">Session Active</p>
                    </div>
                    <Button variant="ghost" size="icon" onClick={handleSignOut} className="h-9 w-9 text-rose-500 hover:bg-rose-50 rounded-full">
                        <LogOut className="h-5 w-5" />
                    </Button>
                </div>
            </header>

            <main className="p-4 lg:p-6 flex-1 space-y-6 w-full">
                <Tabs defaultValue="cabinet" className="w-full">
                    <TabsList className="flex flex-nowrap w-full overflow-x-auto no-scrollbar md:grid md:grid-cols-5 md:overflow-visible justify-start md:justify-center bg-muted/50 p-1 rounded-xl h-auto md:h-12 gap-1 [&>button]:shrink-0">
                        <TabsTrigger value="cabinet" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">
                            <UserCheck className="h-4 w-4 mr-2" /> Cabinet
                        </TabsTrigger>
                        <TabsTrigger value="ordonnances" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">
                            <FileText className="h-4 w-4 mr-2" /> Ordonnances
                        </TabsTrigger>
                        <TabsTrigger value="calendar" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">
                            <CalendarIcon className="h-4 w-4 mr-2" /> Agenda
                        </TabsTrigger>
                        <TabsTrigger value="patients" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">
                            <Users className="h-4 w-4 mr-2" /> Patients
                        </TabsTrigger>
                        <TabsTrigger value="analytics" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">
                            <PieChart className="h-4 w-4 mr-2" /> Analyses
                        </TabsTrigger>
                    </TabsList>

                    {/* CABINET CONTENT */}
                    <TabsContent value="cabinet" className="mt-8 animate-in fade-in slide-in-from-bottom-3 duration-500">
                        <div className="mb-8 px-2 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <h1 className="text-2xl font-black italic text-slate-800">Gestion des Traitements</h1>
                            <Button
                                onClick={() => setShowQueueDialog(true)}
                                className="rounded-xl h-11 px-6 shadow-lg shadow-primary/20 bg-primary hover:bg-primary/90 font-bold"
                            >
                                <Clock className="h-4 w-4 mr-2" /> File d'attente
                            </Button>
                        </div>

                        {activeCabinetEntries.length > 0 ? (
                            <div className="w-full">
                                <Card className="border-none shadow-premium rounded-[2.5rem] overflow-hidden bg-white">
                                    <div className="p-10 border-b bg-slate-50/50">
                                        <div className="flex flex-col items-center text-center gap-4">
                                            <div className="h-20 w-20 bg-primary/10 rounded-[2rem] flex items-center justify-center shadow-inner">
                                                <UserCheck className="h-10 w-10 text-primary" />
                                            </div>
                                            <div>
                                                <h2 className="text-3xl font-black italic text-slate-800 uppercase tracking-tight">Définir le traitement</h2>
                                                <p className="text-xs text-slate-400 font-bold uppercase tracking-[0.3em] leading-tight mt-1">Patient · {selectedEntry?.patient_name}</p>
                                            </div>

                                            {activeCabinetEntries.length > 1 && (
                                                <div className="mt-4 flex items-center gap-4 bg-white p-2.5 rounded-2xl border border-slate-100 shadow-sm">
                                                    <span className="text-[10px] font-black uppercase text-slate-400 pl-2 tracking-widest">Choisir Patient :</span>
                                                    <div className="flex gap-1.5">
                                                        {activeCabinetEntries.map((entry, idx) => (
                                                            <Button
                                                                key={entry.id}
                                                                variant={selectedEntry?.id === entry.id ? 'default' : 'ghost'}
                                                                className={cn(
                                                                    "h-10 w-10 rounded-xl font-black text-xs p-0 transition-all",
                                                                    selectedEntry?.id === entry.id ? "bg-primary text-white shadow-lg shadow-primary/20 scale-110" : "text-slate-400 hover:bg-slate-50"
                                                                )}
                                                                onClick={() => handleCompleteClick(entry)}
                                                            >
                                                                {idx + 1}
                                                            </Button>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="p-10 bg-white">
                                        <div className="max-w-4xl mx-auto space-y-12">
                                            {/* HISTORIQUE */}
                                            {historyTreatments.length > 0 && (
                                                <div className="space-y-4 text-center">
                                                    <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">Historique des traitements</p>
                                                    <div className="flex flex-col gap-2">
                                                        {historyTreatments.map(ht => (
                                                            <Button
                                                                key={ht.treatment}
                                                                variant={selectedHistoryTreatment === ht.treatment ? 'secondary' : 'outline'}
                                                                className={cn(
                                                                    "justify-between h-14 rounded-2xl border-slate-100 font-bold px-6 group transition-all",
                                                                    selectedHistoryTreatment === ht.treatment ? "bg-primary/5 border-primary/20 text-primary ring-2 ring-primary/10" : "hover:bg-slate-50"
                                                                )}
                                                                onClick={() => {
                                                                    if (selectedHistoryTreatment === ht.treatment) {
                                                                        setSelectedHistoryTreatment(null);
                                                                        setTreatment('');
                                                                        setTotalAmount('');
                                                                        setTotalPaidPreviously(0);
                                                                    } else {
                                                                        setSelectedHistoryTreatment(ht.treatment);
                                                                        setTreatment(ht.treatment);
                                                                        setTotalAmount(ht.totalAmount?.toString() || '');
                                                                        setTotalPaidPreviously(ht.totalPaid || 0);
                                                                    }
                                                                }}
                                                            >
                                                                <span className="truncate">{ht.treatment}</span>
                                                                <Badge variant="outline" className="border-none font-black text-[10px] bg-slate-100 text-slate-500 rounded-lg">
                                                                    {(ht.totalPaid || 0).toLocaleString()} / {(ht.totalAmount || 0).toLocaleString()} DZD
                                                                </Badge>
                                                            </Button>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {/* MULTI-ACTS SECTION */}
                                            <div className="space-y-4">
                                                <div className="flex items-center justify-between px-2">
                                                    <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">Actes réalisés ({selectedActs.length})</p>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => setIsAddActOpen(true)}
                                                        className="h-8 rounded-xl border-primary/20 text-primary font-bold px-4 hover:bg-primary/5"
                                                    >
                                                        <Plus className="h-3.5 w-3.5 mr-1.5" /> Ajouter un acte
                                                    </Button>
                                                </div>

                                                {selectedActs.length > 0 && (
                                                    <div className="space-y-2">
                                                        {selectedActs.map((act, idx) => (
                                                            <div key={idx} className="flex items-center justify-between p-4 bg-slate-50 border border-slate-100 rounded-2xl animate-in fade-in slide-in-from-top-2">
                                                                <div className="flex items-center gap-3">
                                                                    <div className="h-2 w-2 rounded-full bg-primary" />
                                                                    <span className="font-bold text-slate-700">{act.name}</span>
                                                                </div>
                                                                <div className="flex items-center gap-4">
                                                                    <span className="font-black text-primary">{act.price.toLocaleString()} DZD</span>
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        onClick={() => removeAct(idx)}
                                                                        className="h-8 w-8 text-slate-300 hover:text-rose-500 rounded-full"
                                                                    >
                                                                        <X className="h-4 w-4" />
                                                                    </Button>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>

                                            {/* DENTAL CHART SECTION */}
                                            <DentalChart
                                                selectedTeeth={selectedTeeth}
                                                onToggle={toggleTooth}
                                                onClear={() => setSelectedTeeth([])}
                                            />

                                            {/* TRAITEMENT (READ-ONLY IF ACTS EXIST) */}
                                            <div className="space-y-3 text-center">
                                                <label className="text-[11px] font-black uppercase tracking-widest text-slate-400">
                                                    {selectedHistoryTreatment && selectedActs.length > 0
                                                        ? 'Nouveaux actes à ajouter au traitement'
                                                        : selectedHistoryTreatment
                                                            ? 'Traitement existant'
                                                            : 'Détails du Traitement'}
                                                </label>
                                                <div className="relative">
                                                    <Input
                                                        placeholder="Saisissez l'acte médical..."
                                                        value={treatment}
                                                        onChange={(e) => {
                                                            setTreatment(e.target.value);
                                                            setShowTreatmentSuggestions(true);
                                                        }}
                                                        onFocus={() => setShowTreatmentSuggestions(true)}
                                                        onBlur={() => setTimeout(() => setShowTreatmentSuggestions(false), 200)}
                                                        disabled={!!selectedHistoryTreatment}
                                                        className="h-16 rounded-3xl border-slate-200 bg-white font-black px-8 text-lg text-center focus:ring-primary/20 shadow-sm"
                                                    />
                                                    {showTreatmentSuggestions && (
                                                        <div className="absolute left-0 right-0 mt-2 bg-white border border-slate-100 rounded-3xl overflow-hidden shadow-2xl max-h-48 overflow-y-auto z-50 animate-in fade-in slide-in-from-top-2">
                                                            {treatmentsList
                                                                .filter(t => {
                                                                    const q = treatment.trim().toLowerCase();
                                                                    if (!q) return false;
                                                                    return t.toLowerCase().includes(q);
                                                                })
                                                                .slice(0, 8)
                                                                .map(s => (
                                                                    <button
                                                                        key={s}
                                                                        type="button"
                                                                        onMouseDown={(e) => { e.preventDefault(); setTreatment(s); setShowTreatmentSuggestions(false); }}
                                                                        className="w-full text-center px-6 py-4 hover:bg-slate-50 font-black text-sm text-slate-700 transition-colors border-b last:border-0 border-slate-50"
                                                                    >
                                                                        {s}
                                                                    </button>
                                                                ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* MONTANT TOTAL */}
                                            <div className="space-y-3 text-center">
                                                <label className="text-[11px] font-black uppercase tracking-widest text-slate-400">
                                                    {selectedHistoryTreatment && selectedActs.length > 0
                                                        ? 'Montant des nouveaux actes (DZD)'
                                                        : selectedHistoryTreatment
                                                            ? 'Montant du traitement existant (DZD)'
                                                            : 'Montant total (DZD)'}
                                                </label>
                                                <Input
                                                    placeholder="0"
                                                    value={totalAmount}
                                                    onChange={(e) => setTotalAmount(e.target.value)}
                                                    type="number"
                                                    disabled={!!selectedHistoryTreatment}
                                                    className="h-16 rounded-3xl border-slate-200 bg-slate-50/50 font-black text-slate-700 text-center text-xl shadow-inner"
                                                />
                                            </div>

                                            {/* NOTE */}
                                            <div className="space-y-3 text-center">
                                                <label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Note observationnelle</label>
                                                <Input
                                                    placeholder="Observations, détails du soin..."
                                                    value={completeNotes}
                                                    onChange={(e) => setCompleteNotes(e.target.value)}
                                                    className="h-16 rounded-3xl border-slate-200 bg-white font-black px-8 text-center text-slate-600 shadow-sm"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="p-10 border-t bg-slate-50/50 flex justify-center">
                                        <Button
                                            onClick={handleComplete}
                                            disabled={isCompletingClient}
                                            className="h-16 rounded-[2rem] font-black px-24 shadow-2xl shadow-primary/30 bg-primary hover:bg-primary/90 text-white transition-all text-base uppercase tracking-[0.2em] w-full sm:w-auto"
                                        >
                                            {isCompletingClient ? 'Enregistrement...' : 'Confirmer'}
                                        </Button>
                                    </div>
                                </Card>
                            </div>
                        ) : (
                            <div className="py-24 text-center bg-white rounded-[3rem] border-2 border-dashed border-slate-100 flex flex-col items-center w-full shadow-sm">
                                <div className="h-20 w-20 bg-primary/10 rounded-full flex items-center justify-center mb-6">
                                    <UserCheck className="h-10 w-10 text-primary/30" />
                                </div>
                                <h3 className="text-xl font-black text-slate-400 uppercase tracking-widest mb-2">Cabinet Vide</h3>
                                <p className="text-xs text-slate-400 font-medium max-w-[280px] mx-auto">Aucun patient n'est actuellement en consultation.</p>
                                <Button
                                    variant="ghost"
                                    className="mt-8 text-[10px] font-black uppercase text-primary bg-primary/5 rounded-full px-6 hover:bg-primary/10"
                                    onClick={() => fetchDashboardData()}
                                >
                                    Actualiser
                                </Button>
                            </div>
                        )}
                    </TabsContent>

                    {/* ORDONNANCES CONTENT */}
                    <TabsContent value="ordonnances" className="mt-6 animate-in fade-in slide-in-from-bottom-2">
                        <div className="flex flex-col gap-6">
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                                <h1 className="text-2xl font-black italic text-slate-800">Gestion des Ordonnances</h1>
                                <div className="flex gap-2 h-11 items-center">

                                    <Button onClick={() => setShowOrdonnanceModal(true)} className="rounded-xl h-11 px-6 shadow-lg shadow-primary/20 bg-primary hover:bg-primary/90 font-bold">
                                        <Plus className="h-4 w-4 mr-2" /> Nouvelle Ordonnance
                                    </Button>
                                </div>
                            </div>

                            {/* TEMPLATES SECTION */}
                            <div className="space-y-6">

                                {templates.length > 0 ? (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                                        {templates.map(t => (
                                            <Card
                                                key={t.id}
                                                className="border shadow-sm bg-white hover:shadow-xl hover:border-primary/20 transition-all cursor-pointer group rounded-3xl overflow-hidden relative border-slate-100"
                                                onClick={() => { loadTemplate(t); setShowOrdonnanceModal(true); }}
                                            >
                                                <div className="p-5 flex items-center justify-between bg-slate-50/50 group-hover:bg-primary/5 transition-colors">
                                                    <div className="flex items-center gap-2 overflow-hidden">
                                                        <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                                                        <h4 className="text-[13px] font-black text-slate-700 truncate uppercase tracking-tight">{t.name}</h4>
                                                    </div>
                                                    <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); deleteTemplate(t.id); }} className="h-8 w-8 text-slate-300 hover:text-rose-500 rounded-full hover:bg-rose-50">
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                                <div className="p-5 space-y-2 h-24 overflow-hidden bg-white">
                                                    {t.medications.slice(0, 3).map((m: any, i: number) => (
                                                        <div key={i} className="flex items-center gap-2">
                                                            <div className="h-1 w-1 rounded-full bg-slate-300" />
                                                            <p className="text-[11px] text-slate-500 font-bold truncate">{m.name}</p>
                                                        </div>
                                                    ))}
                                                    {t.medications.length > 3 && <p className="text-[10px] text-primary/60 font-black italic pl-3">+{t.medications.length - 3} autres...</p>}
                                                </div>
                                                <div className="px-5 py-3 border-t bg-slate-50/30 flex justify-end">
                                                    <span className="text-[9px] font-black uppercase text-primary tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">Charger ce modèle</span>
                                                </div>
                                            </Card>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="py-20 text-center bg-white rounded-3xl border-2 border-dashed border-slate-100">
                                        <div className="h-20 w-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6">
                                            <ClipboardList className="h-10 w-10 text-slate-200" />
                                        </div>
                                        <h3 className="text-lg font-black text-slate-400 uppercase tracking-widest mb-2">Aucun modèle</h3>
                                        <p className="text-xs text-slate-400 font-medium max-w-[300px] mx-auto">Créez une ordonnance et cliquez sur "Enregistrer comme modèle" pour la retrouver ici.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </TabsContent>

                    {/* CALENDAR CONTENT */}
                    <TabsContent value="calendar" className="mt-6 animate-in fade-in slide-in-from-bottom-2">
                        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">
                            <Card className={`border-none shadow-premium bg-white rounded-3xl overflow-hidden transition-all duration-300 ${isCalendarFullscreen ? 'fixed inset-0 z-50 rounded-none m-0' : ''}`} onDoubleClick={() => setIsCalendarFullscreen(prev => !prev)}>
                                <CardContent className="p-0 h-full flex flex-col">
                                    <div className="p-6 border-b bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-4">
                                        <div>
                                            <h3 className="font-black italic text-xl text-primary">Emploi du Temps</h3>
                                            <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">{format(calendarDate || new Date(), 'EEEE dd MMMM yyyy', { locale: fr })}</p>
                                        </div>
                                        <div className="flex gap-2">
                                            <Button variant="outline" className="h-10 px-4 text-xs font-bold uppercase tracking-widest rounded-xl" onClick={() => setCalendarDate(new Date())}>Aujourd'hui</Button>
                                        </div>
                                    </div>
                                    <div className="p-4 sm:p-8 flex-1">
                                        <ScrollArea className={`${isCalendarFullscreen ? 'h-[calc(100vh-100px)]' : 'h-[600px]'} pr-4`}>
                                            <div className="grid grid-cols-[60px_1fr] gap-6">
                                                <div className="space-y-[60px] pt-10 text-[10px] font-black text-slate-300 text-right pr-4 border-r border-slate-100">
                                                    {['07:00', '07:30', '08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '12:00', '12:30', '13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00', '17:30', '18:00', '18:30', '19:00', '19:30', '20:00', '20:30', '21:00', '21:30', '22:00'].map(t => (<div key={t} className={`h-0 flex items-center justify-end ${t.endsWith(':00') ? 'text-slate-400 font-black' : 'text-slate-300 font-medium'}`}>{t}</div>))}
                                                </div>
                                                <div className="relative bg-slate-50/30 rounded-3xl min-h-[2000px] border border-dashed border-slate-200">
                                                    <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-md p-4 border-b text-center font-black text-xs text-primary uppercase tracking-[0.2em] rounded-t-3xl">Planning {doctorInfo?.name}</div>
                                                    {parsedAppointments.filter(a => a.status !== 'denied' && a.doctor_id === doctorInfo?.id && a.startOfDayTime === startOfDay(calendarDate || new Date()).getTime()).map(appt => {
                                                        const date = parseISO(appt.appointment_at);
                                                        const hours = date.getHours();
                                                        const minutes = date.getMinutes();
                                                        const offset = (hours - 7) * 120 + (minutes / 60) * 120 + 64;
                                                        const durMatch = appt.notes?.match(/\[DUR:(\d+)\]/);
                                                        const duration = durMatch ? parseInt(durMatch[1]) : 60;
                                                        const displayNotes = appt.notes?.replace(/\[DUR:\d+\]\s*/, '') || 'Sans note';
                                                        const cardHeight = (duration / 60) * 120 - 10;
                                                        return (
                                                            <Card key={appt.id} className={cn("absolute left-4 right-4 shadow-xl border-l-4 p-4 rounded-2xl cursor-pointer hover:scale-[1.02] transition-all z-20 group", appt.status === 'completed' ? 'border-l-emerald-500 bg-white' : 'border-l-primary bg-white')} style={{ top: `${offset}px`, height: `${cardHeight}px` }} onClick={() => { setSelectedPatient(patients.find(p => p.phone === appt.client_phone)); setIsPatientDialogOpen(true); }}>
                                                                <div className="flex justify-between items-start">
                                                                    <div>
                                                                        <p className="text-[10px] font-black text-primary mb-1 uppercase tracking-widest">{format(date, 'HH:mm')}</p>
                                                                        <p className="text-sm font-black text-slate-800 leading-tight">{appt.client_name}</p>
                                                                    </div>
                                                                    <Badge className={cn("text-[8px] font-black rounded-full h-5", appt.status === 'completed' ? 'bg-emerald-50 text-emerald-600' : 'bg-primary/5 text-primary')}>{appt.status.toUpperCase()}</Badge>
                                                                </div>
                                                                <p className="text-[10px] text-slate-400 font-bold mt-1 line-clamp-1">{displayNotes}</p>
                                                            </Card>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        </ScrollArea>
                                    </div>
                                </CardContent>
                            </Card>
                            <div className="space-y-6">
                                <Card className="border-none shadow-premium bg-white rounded-3xl p-2">
                                    <Calendar mode="single" selected={calendarDate} onSelect={setCalendarDate} className="rounded-2xl" locale={fr} />
                                </Card>
                                <Card className="border-none shadow-premium bg-primary text-white p-6 rounded-[2rem]">
                                    <div className="flex items-center gap-3 mb-6">
                                        <div className="h-10 w-10 bg-white/20 rounded-2xl flex items-center justify-center"><CalIcon className="h-5 w-5 text-white" /></div>
                                        <h4 className="font-black italic text-lg">Résumé Journée</h4>
                                    </div>
                                    <div className="space-y-4">
                                        <div className="flex justify-between items-center bg-white/10 p-4 rounded-2xl">
                                            <span className="text-[10px] font-black uppercase tracking-widest opacity-60">À venir</span>
                                            <span className="text-2xl font-black">{parsedAppointments.filter(a => a.doctor_id === doctorInfo?.id && a.status === 'scheduled' && a.startOfDayTime === startOfDay(calendarDate || new Date()).getTime()).length}</span>
                                        </div>
                                        <div className="flex justify-between items-center bg-white/10 p-4 rounded-2xl">
                                            <span className="text-[10px] font-black uppercase tracking-widest opacity-60">Terminés</span>
                                            <span className="text-2xl font-black">{parsedAppointments.filter(a => a.doctor_id === doctorInfo?.id && a.status === 'completed' && a.startOfDayTime === startOfDay(calendarDate || new Date()).getTime()).length}</span>
                                        </div>
                                    </div>
                                </Card>
                            </div>
                        </div>
                    </TabsContent>

                    {/* PATIENTS CONTENT */}
                    <TabsContent value="patients" className="mt-6 animate-in fade-in slide-in-from-bottom-2">
                        <div className="space-y-6">
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                                <h1 className="text-2xl font-black italic text-slate-800">Votre Fichier Patient</h1>
                                <div className="relative w-full sm:w-80">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                    <Input placeholder="Nom ou téléphone..." value={searchPatient} onChange={e => setSearchPatient(e.target.value)} className="pl-10 h-11 border-slate-200 rounded-xl" />
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {filteredPatientsList.map(p => (
                                    <Card key={p.id} className="border-none shadow-premium bg-white hover:shadow-lg transition-all cursor-pointer group" onClick={() => { setSelectedPatient(p); setIsPatientDialogOpen(true); }}>
                                        <CardContent className="p-6">
                                            <div className="flex items-center gap-4 mb-4">
                                                <div className="h-12 w-12 rounded-2xl bg-primary/5 flex items-center justify-center text-primary font-black text-xl group-hover:bg-primary group-hover:text-white transition-all">{p.client_name.charAt(0)}</div>
                                                <div>
                                                    <h3 className="font-bold text-slate-800">{p.client_name}</h3>
                                                    <p className="text-xs text-slate-400">{p.phone}</p>
                                                </div>
                                            </div>
                                            <div className="space-y-2 border-t pt-4">
                                                <div className="flex justify-between text-xs font-medium"><span className="text-slate-400 uppercase tracking-widest">Traitement</span><span className="text-slate-700">{p.treatment}</span></div>
                                                <div className="flex justify-between text-xs font-medium"><span className="text-slate-400 uppercase tracking-widest">Dernière séance</span><span className="text-slate-700">{format(new Date(p.completed_at), 'dd/MM/yy')}</span></div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        </div>
                    </TabsContent>

                    {/* ANALYTICS CONTENT */}
                    <TabsContent value="analytics" className="mt-6 animate-in fade-in slide-in-from-bottom-2">
                        <div className="space-y-8">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <Card className="border-none shadow-premium bg-gradient-to-br from-indigo-500 to-indigo-600 text-white rounded-3xl">
                                    <CardContent className="p-6">
                                        <div className="flex justify-between items-start mb-4">
                                            <DollarSign className="h-8 w-8 text-white/20" />
                                            <Input type="date" value={selectedRevenueDate} onChange={e => setSelectedRevenueDate(e.target.value)} className="w-auto h-7 text-[10px] font-bold bg-white/10 border-0 rounded-full text-white cursor-pointer" />
                                        </div>
                                        <p className="text-white/60 text-xs font-bold uppercase tracking-widest">Revenu du Jour Choisi</p>
                                        <h3 className="text-3xl font-black">{selectedDayRevenue.toLocaleString()} DZD</h3>
                                    </CardContent>
                                </Card>
                                <Card className="border-none shadow-premium bg-white rounded-3xl">
                                    <CardContent className="p-6">
                                        <Users className="h-8 w-8 text-primary/20 mb-4" />
                                        <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Patients Actifs</p>
                                        <h3 className="text-3xl font-black text-slate-800">{filteredPaymentsByDate.length}</h3>
                                    </CardContent>
                                </Card>
                            </div>
                            <div className="grid grid-cols-1 gap-8">
                                <Card className="border-none shadow-premium bg-white rounded-3xl overflow-hidden">
                                    <CardHeader className="p-6 border-b bg-muted/10">
                                        <CardTitle className="text-lg font-black italic flex items-center gap-2"><DollarSign className="h-5 w-5 text-primary" /> Détails des Paiements Récents</CardTitle>
                                        <CardDescription className="text-xs uppercase font-bold tracking-widest opacity-60">Dernières consultations terminées</CardDescription>
                                    </CardHeader>
                                    <CardContent className="p-0">
                                        <div className="h-[450px] overflow-y-auto no-scrollbar">
                                            <div className="overflow-x-auto no-scrollbar md:overflow-x-visible [&_.relative]:no-scrollbar">
                                                <Table className="min-w-[640px] md:min-w-full">
                                                <TableHeader className="bg-muted/30">
                                                    <TableRow>
                                                        <TableHead className="font-black text-[10px] uppercase tracking-wider text-center">Patient</TableHead>
                                                        <TableHead className="font-black text-[10px] uppercase tracking-wider text-center">Heure</TableHead>
                                                        <TableHead className="font-black text-[10px] uppercase tracking-wider text-center">Traitement</TableHead>
                                                        <TableHead className="font-black text-[10px] uppercase tracking-wider text-center">Total</TableHead>
                                                        <TableHead className="font-black text-[10px] uppercase tracking-wider text-center">Payé</TableHead>
                                                        <TableHead className="font-black text-[10px] uppercase tracking-wider text-center">Reste</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {filteredPaymentsByDate.map((p, idx) => (
                                                        <TableRow key={p.id || idx} className="hover:bg-slate-50 transition-colors">
                                                            <TableCell className="text-center font-black text-sm text-foreground uppercase tracking-tight">{p.client_name}</TableCell>
                                                            <TableCell className="text-center text-xs text-muted-foreground font-bold">{format(new Date(p.completed_at), 'HH:mm')}</TableCell>
                                                            <TableCell className="text-center text-xs font-bold text-primary italic">{p.treatment}</TableCell>
                                                            <TableCell className="text-center font-bold text-slate-700">{p.total_amount?.toLocaleString()}</TableCell>
                                                            <TableCell className="text-center font-black text-emerald-600 bg-emerald-50/50">{p.tranche_paid?.toLocaleString()}</TableCell>
                                                            <TableCell className="text-center font-black text-rose-500">{(p.total_amount - (p.tranche_paid || 0)).toLocaleString()}</TableCell>
                                                        </TableRow>
                                                    ))}
                                                    {filteredPaymentsByDate.length === 0 && (
                                                        <TableRow><TableCell colSpan={6} className="text-center py-20 text-muted-foreground italic font-bold">Aucun paiement pour cette date</TableCell></TableRow>
                                                    )}
                                                </TableBody>
                                            </Table>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                        </div>
                    </TabsContent>
                </Tabs>

                {/* ADD ACT MODAL */}
                <Dialog open={isAddActOpen} onOpenChange={setIsAddActOpen}>
                    <DialogContent className="max-w-md rounded-[2.5rem] p-0 border-none shadow-2xl overflow-hidden bg-white z-[120]">
                        <DialogHeader className="p-8 border-b bg-primary/5 text-center">
                            <DialogTitle className="text-xl font-black italic text-primary">Ajouter un acte médical</DialogTitle>
                        </DialogHeader>
                        <div className="p-8 space-y-6">
                            <div className="space-y-3">
                                <label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Nom de l'acte</label>
                                <div className="relative">
                                    <Input
                                        placeholder="Ex: Plombage..."
                                        value={newActName}
                                        onChange={(e) => {
                                            setNewActName(e.target.value);
                                            setShowAddActSuggestions(true);
                                        }}
                                        onFocus={() => setShowAddActSuggestions(true)}
                                        className="h-12 rounded-2xl border-slate-200 font-bold px-6"
                                    />
                                    {showAddActSuggestions && newActName.trim() && (
                                        <div className="absolute left-0 right-0 mt-2 bg-white border border-slate-100 rounded-2xl overflow-hidden shadow-2xl max-h-48 overflow-y-auto z-[130]">
                                            {TREATMENTS.filter(t => t.toLowerCase().includes(newActName.toLowerCase())).map(t => (
                                                <button
                                                    key={t}
                                                    type="button"
                                                    onMouseDown={(e) => { e.preventDefault(); setNewActName(t); setShowAddActSuggestions(false); }}
                                                    className="w-full text-left px-6 py-3 hover:bg-slate-50 font-bold text-xs text-slate-700 transition-colors border-b last:border-0 border-slate-50"
                                                >
                                                    {t}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="space-y-3">
                                <label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Montant (DZD)</label>
                                <Input
                                    type="number"
                                    placeholder="0"
                                    value={newActPrice}
                                    onChange={(e) => setNewActPrice(e.target.value)}
                                    className="h-12 rounded-2xl border-slate-200 font-bold px-6"
                                />
                            </div>
                            <Button
                                onClick={addAct}
                                disabled={!newActName || !newActPrice}
                                className="w-full h-14 rounded-2xl bg-primary text-white font-black shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
                            >
                                Ajouter
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>
            </main>

            {/* FICHE MALADE DIALOG */}
            < Dialog open={isPatientDialogOpen} onOpenChange={setIsPatientDialogOpen} >
                <DialogContent className="max-w-3xl overflow-hidden rounded-3xl p-0 border shadow-2xl bg-white animate-in zoom-in-95 duration-200">
                    {selectedPatient && (
                        <div className="flex flex-col h-[85vh]">
                            {/* Simple Header */}
                            <div className="p-6 border-b flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="h-10 w-10 bg-primary/5 rounded-full flex items-center justify-center">
                                        <User className="h-5 w-5 text-primary" />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-bold text-slate-900">{selectedPatient.client_name}</h3>
                                        <p className="text-xs text-slate-400 font-medium">{selectedPatient.phone}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="flex-1 overflow-y-auto bg-slate-50/30 p-6 space-y-6">
                                {/* Quick Stats Row */}
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                    <div className="bg-white p-4 rounded-2xl border shadow-sm">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Dernier Traitement</span>
                                        <span className="font-bold text-slate-700">{selectedPatient.treatment || 'N/A'}</span>
                                    </div>
                                    <div className="bg-white p-4 rounded-2xl border shadow-sm">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Total Payé</span>
                                        <span className="font-bold text-emerald-600">{(selectedPatient.tranche_paid || 0).toLocaleString()} DZD</span>
                                    </div>
                                    <div className="bg-white p-4 rounded-2xl border shadow-sm">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Dette Restante</span>
                                        <span className="font-bold text-rose-500">{(selectedPatient.total_amount - (selectedPatient.tranche_paid || 0)).toLocaleString()} DZD</span>
                                    </div>
                                </div>


                                {/* History Tabs */}
                                <Tabs defaultValue="rendezvous" className="w-full">
                                    <TabsList className="bg-slate-100/50 p-1 rounded-xl mb-4 h-auto flex-wrap w-full sm:w-auto">
                                        <TabsTrigger value="rendezvous" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm px-4 sm:px-6 py-2 text-xs font-bold uppercase tracking-wider">Agenda</TabsTrigger>
                                        <TabsTrigger value="ordonnances" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm px-4 sm:px-6 py-2 text-xs font-bold uppercase tracking-wider">Ordonnances</TabsTrigger>
                                        <TabsTrigger value="historique" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm px-4 sm:px-6 py-2 text-xs font-bold uppercase tracking-wider">Historique</TabsTrigger>
                                    </TabsList>

                                    <TabsContent value="rendezvous" className="mt-0 space-y-3">
                                        {isLoadingHistory ? (
                                            <div className="p-10 text-center text-slate-300 animate-pulse font-bold text-sm uppercase">Chargement...</div>
                                        ) : patientHistory?.appointments.length === 0 ? (
                                            <div className="p-8 text-center text-slate-300 border border-dashed rounded-2xl text-xs font-black uppercase">Aucune séance passée</div>
                                        ) : (
                                            patientHistory?.appointments.map((a: any, idx: number) => (
                                                <div key={idx} className="bg-white p-4 rounded-xl border shadow-sm flex items-center justify-between">
                                                    <div className="flex items-center gap-4">
                                                        <div className="h-8 w-8 bg-slate-50 flex items-center justify-center rounded-lg text-xs font-black text-slate-400 uppercase tracking-tighter">
                                                            {format(new Date(a.appointment_at), 'dd/MM')}
                                                        </div>
                                                        <div>
                                                            <p className="text-sm font-bold text-slate-700">Séance avec {a.doctor?.name || 'Généraliste'}</p>
                                                            <p className="text-[10px] text-slate-400 font-bold uppercase">{format(new Date(a.appointment_at), 'HH:mm')}</p>
                                                        </div>
                                                    </div>
                                                    <Badge variant="outline" className="text-[8px] font-black uppercase border-slate-200">{a.status}</Badge>
                                                </div>
                                            ))
                                        )}
                                    </TabsContent>

                                    <TabsContent value="ordonnances" className="mt-0 space-y-3">
                                        {isLoadingHistory ? (
                                            <div className="p-10 text-center text-slate-300 animate-pulse font-bold text-sm uppercase">Recherche...</div>
                                        ) : patientHistory?.ordonnances.length === 0 ? (
                                            <div className="p-8 text-center text-slate-300 border border-dashed rounded-2xl text-xs font-black uppercase">Aucune ordonnance émise</div>
                                        ) : (
                                            patientHistory?.ordonnances.map((o: any, idx: number) => {
                                                const meds = Array.isArray(o.medications) 
                                                    ? o.medications 
                                                    : (typeof o.medications === 'string' ? JSON.parse(o.medications) : []);
                                                const ordData = { ...o, medications: meds };
                                                return (
                                                    <div 
                                                        key={idx} 
                                                        className="bg-white p-4 rounded-xl border shadow-sm flex items-center justify-between group cursor-pointer hover:border-primary transition-colors"
                                                        onClick={() => setViewingOrdonnance(ordData)}
                                                    >
                                                        <div className="flex items-center gap-4">
                                                            <FileText className="h-5 w-5 text-slate-300 group-hover:text-primary transition-colors" />
                                                            <div>
                                                                <p className="text-sm font-bold text-slate-700">Ordonnance du {format(new Date(o.prescription_date), 'dd MMMM yyyy', { locale: fr })}</p>
                                                                <div className="flex gap-1 mt-1 flex-wrap">
                                                                    {meds.slice(0, 2).map((m: any, i: number) => (
                                                                        <Badge key={i} className="bg-slate-50 text-slate-400 border-none text-[8px] font-black">{m.name}</Badge>
                                                                    ))}
                                                                    {meds.length > 2 && <span className="text-[8px] font-bold text-slate-300">+{meds.length - 2}</span>}
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8 text-slate-300 hover:text-primary hover:bg-primary/5 rounded-full"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handlePrintOrdonnance(ordData);
                                                            }}
                                                            title="Imprimer l'ordonnance"
                                                        >
                                                            <Printer className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                );
                                            })
                                        )}
                                    </TabsContent>

                                    <TabsContent value="historique" className="mt-0 space-y-4">
                                        <div className="border rounded-xl overflow-hidden shadow-sm">
                                            <Table>
                                                <TableHeader className="bg-muted/50">
                                                    <TableRow>
                                                        <TableHead className="text-xs h-9 font-bold text-center">Date</TableHead>
                                                        <TableHead className="text-xs h-9 font-bold text-center">Traitement</TableHead>
                                                        <TableHead className="text-xs h-9 font-bold text-center">Note</TableHead>
                                                        <TableHead className="text-xs h-9 font-bold text-center">Total (DZD)</TableHead>
                                                        <TableHead className="text-xs h-9 font-bold text-center">Payé (DZD)</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {patients.filter(p => p.phone === selectedPatient.phone && p.client_name === selectedPatient.client_name).length === 0 ? (
                                                        <TableRow>
                                                            <TableCell colSpan={5} className="text-center py-6 text-slate-400 text-xs uppercase tracking-wider font-bold">
                                                                Aucun historique
                                                            </TableCell>
                                                        </TableRow>
                                                    ) : (
                                                        patients.filter(p => p.phone === selectedPatient.phone && p.client_name === selectedPatient.client_name).map((h, idx) => (
                                                            <TableRow key={h.id || idx} className="bg-white hover:bg-slate-50 transition-colors">
                                                                <TableCell className="text-xs py-3 font-medium text-slate-600 text-center">{format(new Date(h.completed_at), 'dd/MM/yy')}</TableCell>
                                                                <TableCell className="text-xs py-3 text-slate-700 text-center">
                                                                    <div>{h.treatment || '-'}</div>
                                                                </TableCell>
                                                                <TableCell className="text-xs py-3 text-slate-500 max-w-[150px] truncate text-center mx-auto cursor-pointer hover:text-primary transition-all font-medium italic underline decoration-dotted underline-offset-2" onClick={() => h.notes && setViewingNote(h.notes)}>{h.notes || '-'}</TableCell>
                                                                <TableCell className="text-xs py-3 font-bold text-slate-800 text-center">{h.total_amount?.toLocaleString() || 0}</TableCell>
                                                                <TableCell className="text-xs py-3 font-bold text-emerald-600 text-center">{h.tranche_paid?.toLocaleString() || 0}</TableCell>
                                                            </TableRow>
                                                        ))
                                                    )}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    </TabsContent>
                                </Tabs>
                            </div>

                            <div className="p-4 border-t bg-white flex justify-end">
                                <Button onClick={() => setIsPatientDialogOpen(false)} className="rounded-xl h-11 px-8 font-black uppercase text-xs tracking-widest">
                                    Fermer
                                </Button>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog >

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

            {/* ORDONNANCE DETAILS DIALOG */}
            <Dialog open={!!viewingOrdonnance} onOpenChange={(open) => !open && setViewingOrdonnance(null)}>
                <DialogContent className="max-w-lg w-[95vw] rounded-3xl p-0 shadow-2xl border-none overflow-hidden bg-white z-[130]">
                    {viewingOrdonnance && (
                        <div>
                            {/* Header */}
                            <div className="p-6 bg-gradient-to-r from-primary/10 to-primary/5 border-b flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="h-10 w-10 bg-primary text-white rounded-2xl flex items-center justify-center shadow-md">
                                        <FileText className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <DialogTitle className="text-lg font-black italic text-slate-800">
                                            Détails de l'Ordonnance
                                        </DialogTitle>
                                        <p className="text-xs text-slate-400 font-semibold">
                                            {viewingOrdonnance.prescription_date ? format(new Date(viewingOrdonnance.prescription_date), 'dd MMMM yyyy', { locale: fr }) : ''}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Content */}
                            <div className="p-6 space-y-6 max-h-[65vh] overflow-y-auto">
                                {/* Patient Info */}
                                <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                                    <div>
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-0.5">Patient</span>
                                        <span className="text-sm font-bold text-slate-800">{viewingOrdonnance.patient_name || 'N/A'}</span>
                                    </div>
                                    <div>
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-0.5">Âge</span>
                                        <span className="text-sm font-bold text-slate-800">{viewingOrdonnance.age ? `${viewingOrdonnance.age} ans` : '--'}</span>
                                    </div>
                                </div>

                                {/* Medications */}
                                <div className="space-y-3">
                                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-2">
                                        <Pill className="h-4 w-4 text-primary" /> Médicaments Prescrits
                                    </h4>
                                    <div className="space-y-3">
                                        {Array.isArray(viewingOrdonnance.medications) && viewingOrdonnance.medications.length > 0 ? (
                                            viewingOrdonnance.medications.map((m: any, idx: number) => {
                                                const timingMap: Record<string, string> = {
                                                    'avant': 'avant le repas',
                                                    'apres': 'après le repas',
                                                    'pendant': 'pendant le repas',
                                                    'soir': 'le soir',
                                                    'à jeun': 'à jeun'
                                                };
                                                const timingText = timingMap[m.timing] || m.timing || '';
                                                return (
                                                    <div key={idx} className="p-4 bg-slate-50/50 border border-slate-100 rounded-2xl space-y-1 hover:border-primary/30 transition-colors">
                                                        <div className="flex justify-between items-center">
                                                            <span className="font-bold text-slate-800 text-sm">{m.name}</span>
                                                            {(m.duree || m.duration) && (
                                                                <Badge variant="outline" className="text-[10px] font-black border-primary/20 text-primary bg-primary/5">
                                                                    Qsp: {m.duree || m.duration}
                                                                </Badge>
                                                            )}
                                                        </div>
                                                        <div className="text-xs text-slate-500 font-medium italic">
                                                            {m.dosage ? `${m.dosage}` : ''}
                                                            {m.frequency_count ? ` • ${m.frequency_count}x/jour ${timingText}` : (m.instructions ? ` • ${m.instructions}` : '')}
                                                        </div>
                                                    </div>
                                                );
                                            })
                                        ) : (
                                            <p className="text-xs italic text-slate-400">Aucun médicament répertorié.</p>
                                        )}
                                    </div>
                                </div>

                                {/* Notes */}
                                {viewingOrdonnance.notes && (
                                    <div className="p-4 bg-amber-50/50 border border-amber-100 rounded-2xl space-y-1">
                                        <span className="text-[10px] font-black uppercase tracking-wider text-amber-700 block">Note du médecin</span>
                                        <p className="text-xs text-slate-600 font-medium italic">{viewingOrdonnance.notes}</p>
                                    </div>
                                )}
                            </div>

                            {/* Footer */}
                            <div className="p-4 border-t bg-slate-50 flex items-center justify-end">
                                <Button
                                    onClick={() => setViewingOrdonnance(null)}
                                    className="rounded-xl font-bold h-11 px-6 bg-slate-900 text-white hover:bg-slate-800"
                                >
                                    Fermer
                                </Button>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* FILE D'ATTENTE DIALOG */}
            <Dialog open={showQueueDialog} onOpenChange={setShowQueueDialog}>
                <DialogContent className="max-w-2xl overflow-hidden rounded-[2.5rem] border-none shadow-2xl p-0 flex flex-col bg-white">
                    <DialogHeader className="p-8 border-b bg-slate-50/50 flex-shrink-0">
                        <DialogTitle className="text-2xl font-black italic text-primary flex items-center gap-3">
                            <Clock className="h-8 w-8 text-primary animate-pulse" /> File d'attente
                        </DialogTitle>
                    </DialogHeader>

                    <div className="flex-1 overflow-y-auto p-4 space-y-2 max-h-[60vh] bg-slate-50">
                        {doctorEntries.length === 0 ? (
                            <div className="py-12 text-center flex flex-col items-center justify-center bg-white rounded-2xl border border-slate-100">
                                <div className="h-16 w-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                                    <Users className="h-8 w-8 text-slate-300" />
                                </div>
                                <h3 className="text-lg font-black text-slate-400 uppercase tracking-widest mb-1">File d'attente Vide</h3>
                                <p className="text-xs text-slate-400 font-medium max-w-[280px]">Aucun patient ne vous attend pour le moment.</p>
                            </div>
                        ) : (
                            doctorEntries.map((entry, index) => {
                                const stateColors = {
                                    U: 'bg-destructive text-destructive-foreground border-none',
                                    N: 'bg-primary text-primary-foreground border-none',
                                    R: 'bg-foreground text-background border-none',
                                };
                                const stateLabels = { U: 'Urgence', N: 'Nouveau', R: 'Rendez-vous' };

                                return (
                                    <Card key={entry.id} className="border-0 shadow-sm hover:shadow-md transition-shadow bg-white rounded-2xl">
                                        <CardContent className="p-3 sm:p-4 flex items-center justify-between gap-2">
                                            <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                                                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-secondary flex items-center justify-center shrink-0">
                                                    <span className="text-xs sm:text-sm font-bold text-primary">{index + 1}</span>
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="flex items-center gap-1.5 flex-wrap">
                                                        <span className="font-semibold text-sm sm:text-base text-foreground">
                                                            {entry.patient_name || entry.phone}
                                                        </span>
                                                        {entry.patient_name && (
                                                            <span className="text-xs sm:text-sm font-medium text-muted-foreground truncate max-w-[120px] sm:max-w-[200px]">
                                                                · {entry.phone}
                                                            </span>
                                                        )}
                                                        <Badge variant="outline" className={`${stateColors[entry.state]} text-[10px] px-1.5 py-0`}>
                                                            {stateLabels[entry.state]}
                                                        </Badge>
                                                    </div>
                                                    <p className="text-xs text-muted-foreground truncate">
                                                        docteur {entry.doctor?.name || '—'}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 shrink-0">
                                                <a href={`tel:${entry.phone}`} className="text-primary flex items-center justify-center p-1.5 hover:bg-secondary/50 rounded-full transition-colors" title="Appeler">
                                                    <Phone className="h-5 w-5" />
                                                </a>
                                                <Button
                                                    size="sm"
                                                    onClick={() => handleCallPatient(entry)}
                                                    className="gap-1 shrink-0 h-8 sm:h-9 px-2 sm:px-3 text-xs sm:text-sm"
                                                >
                                                    <span className="hidden sm:inline">Suivant</span> <ChevronRight className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </CardContent>
                                    </Card>
                                );
                            })
                        )}
                    </div>

                    <div className="p-8 border-t bg-slate-50/50 flex justify-end flex-shrink-0">
                        <Button onClick={() => setShowQueueDialog(false)} className="rounded-xl h-12 px-8 font-black uppercase text-xs tracking-widest bg-slate-200 text-slate-700 hover:bg-slate-300">
                            Fermer
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>


            <footer className="p-4 border-t bg-muted/20 text-center">
                <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-medium">&copy; PasseVite - Gestion Holistique des Soins</p>
            </footer>

            {/* CREATION ORDONNANCE MODAL */}
            <Dialog open={showOrdonnanceModal} onOpenChange={setShowOrdonnanceModal}>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden rounded-[2.5rem] border-none shadow-2xl p-0 flex flex-col bg-white">
                    <DialogHeader className="p-8 border-b bg-slate-50/50 flex-shrink-0">
                        <DialogTitle className="text-2xl font-black italic text-primary flex items-center gap-3">
                            <FileText className="h-8 w-8" /> Nouvelle Ordonnance
                        </DialogTitle>
                    </DialogHeader>

                    <div className="flex-1 overflow-y-auto p-8 space-y-8">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="space-y-2">
                                <label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Date de prescription</label>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant={"outline"}
                                            className={cn(
                                                "w-full h-12 rounded-2xl border-slate-200 bg-slate-50 font-bold justify-start text-left",
                                                !ordonnanceForm.date && "text-muted-foreground"
                                            )}
                                        >
                                            <CalendarIcon className="mr-2 h-4 w-4" />
                                            {ordonnanceForm.date ? format(parseISO(ordonnanceForm.date), "dd/MM/yyyy") : <span>Choisir une date</span>}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0 rounded-2xl border-none shadow-2xl bg-white" align="start">
                                        <Calendar
                                            mode="single"
                                            selected={ordonnanceForm.date ? parseISO(ordonnanceForm.date) : undefined}
                                            onSelect={(date) => setOrdonnanceForm({ ...ordonnanceForm, date: date ? format(date, "yyyy-MM-dd") : '' })}
                                            initialFocus
                                            locale={fr}
                                        />
                                    </PopoverContent>
                                </Popover>
                            </div>
                            <div className="md:col-span-1 space-y-2">
                                <label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Nom du patient *</label>
                                <Input placeholder="Nom et Prénom" value={ordonnanceForm.patient_name} onChange={e => setOrdonnanceForm({ ...ordonnanceForm, patient_name: e.target.value })} className="h-12 rounded-2xl border-slate-200 font-bold" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Âge</label>
                                <Input type="number" placeholder="--" value={ordonnanceForm.age} onChange={e => setOrdonnanceForm({ ...ordonnanceForm, age: e.target.value })} className="h-12 rounded-2xl border-slate-200 font-bold" />
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="flex justify-between items-center">
                                <h3 className="text-xs font-black italic text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                    <Pill className="h-4 w-4" /> Médicaments Prescrits
                                </h3>
                                <Button variant="outline" size="sm" onClick={addMedicationToForm} className="rounded-xl text-[10px] font-black uppercase tracking-widest h-9 border-primary/20 text-primary hover:bg-primary/5">
                                    <Plus className="h-4 w-4 mr-1.5" /> Ajouter un produit
                                </Button>
                            </div>

                            <div className="space-y-4">
                                {ordonnanceForm.medications.map((med, idx) => (
                                    <div key={idx} className="p-6 bg-slate-50/50 rounded-[2rem] border border-slate-200/50 relative group">
                                        {ordonnanceForm.medications.length > 1 && (
                                            <Button variant="ghost" size="icon" onClick={() => removeMedicationFromForm(idx)} className="absolute -top-3 -right-3 h-8 w-8 rounded-full bg-white shadow-lg text-rose-500 hover:text-rose-600 hover:bg-rose-50 z-10 border border-slate-100">
                                                <X className="h-4 w-4" />
                                            </Button>
                                        )}

                                        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                                            <div className="md:col-span-4 space-y-1.5">
                                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Nom</label>
                                                <Select
                                                    value={med.name}
                                                    onValueChange={(val) => {
                                                        if (val === 'ADD_NEW_MED') {
                                                            setShowNewMedModal(true);
                                                            return;
                                                        }

                                                        const common = COMMON_MEDICATIONS[val];
                                                        const dbMed = dbMedications.find(x => x.name === val);

                                                        const updatedMeds = ordonnanceForm.medications.map((m, i) => {
                                                            if (i !== idx) return m;

                                                            if (common) {
                                                                return {
                                                                    ...m,
                                                                    name: val,
                                                                    dosage: common.dosage,
                                                                    duree: common.duree,
                                                                    frequency_count: common.frequency_count,
                                                                    timing: common.timing
                                                                };
                                                            } else if (dbMed) {
                                                                return {
                                                                    ...m,
                                                                    name: dbMed.name,
                                                                    dosage: dbMed.default_dosage || '',
                                                                    duree: dbMed.default_duration || '',
                                                                    frequency_count: dbMed.default_frequency_count || 1,
                                                                    timing: dbMed.default_timing || 'apres'
                                                                };
                                                            }
                                                            return { ...m, name: val };
                                                        });

                                                        setOrdonnanceForm(prev => ({ ...prev, medications: updatedMeds }));
                                                    }}
                                                >
                                                    <SelectTrigger className="h-11 rounded-xl border-slate-200 bg-white font-bold"><SelectValue placeholder="Choisir..." /></SelectTrigger>
                                                    <SelectContent className="max-h-64 rounded-2xl shadow-2xl border-none bg-white z-[60]">
                                                        <ScrollArea className="h-64">
                                                            <SelectItem value="ADD_NEW_MED" className="font-black text-primary border-b border-primary/10 py-3 bg-primary/5 hover:bg-primary/10 mb-1">
                                                                <Plus className="h-4 w-4 mr-2 inline" /> Nouveau Médicament
                                                            </SelectItem>
                                                            {/* Combine Common & DB Meds, avoiding duplicates */}
                                                            {Array.from(new Set([
                                                                ...Object.keys(COMMON_MEDICATIONS),
                                                                ...dbMedications.map(m => m.name)
                                                            ])).sort().map(name => (
                                                                <SelectItem key={name} value={name} className="font-bold py-2.5">
                                                                    {name}
                                                                </SelectItem>
                                                            ))}
                                                        </ScrollArea>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="md:col-span-2 space-y-1.5">
                                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Dose</label>
                                                <Input placeholder="1cp..." value={med.dosage} onChange={e => updateMedicationInForm(idx, 'dosage', e.target.value)} className="h-11 rounded-xl border-slate-200 bg-white font-bold" />
                                            </div>
                                            <div className="md:col-span-2 space-y-1.5">
                                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Durée</label>
                                                <Input placeholder="7 jours" value={med.duree} onChange={e => updateMedicationInForm(idx, 'duree', e.target.value)} className="h-11 rounded-xl border-slate-200 bg-white font-bold" />
                                            </div>
                                            <div className="md:col-span-1 space-y-1.5">
                                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Fréq.</label>
                                                <Input type="number" value={med.frequency_count} onChange={e => updateMedicationInForm(idx, 'frequency_count', parseInt(e.target.value))} className="h-11 rounded-xl border-slate-200 bg-white font-bold" />
                                            </div>
                                            <div className="md:col-span-3 space-y-1.5">
                                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Moment</label>
                                                <Select value={med.timing} onValueChange={v => updateMedicationInForm(idx, 'timing', v)}>
                                                    <SelectTrigger className="h-11 rounded-xl border-slate-200 bg-white font-bold"><SelectValue /></SelectTrigger>
                                                    <SelectContent className="rounded-2xl shadow-xl bg-white z-[60]">
                                                        <SelectItem value="avant">Avant repas</SelectItem>
                                                        <SelectItem value="apres">Après repas</SelectItem>
                                                        <SelectItem value="soir">Le soir</SelectItem>
                                                        <SelectItem value="à jeun">À jeun</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    <DialogFooter className="p-8 border-t bg-slate-50/50 flex-shrink-0 flex sm:justify-between items-center gap-3">
                        <div className="flex gap-2">
                            <Button variant="outline" onClick={saveAsTemplate} className="rounded-xl font-bold h-12 px-4 border-slate-300 text-slate-600 bg-white hover:bg-slate-50">
                                <ClipboardList className="h-5 w-5 mr-2" /> Enregistrer comme Modèle
                            </Button>
                        </div>
                        <div className="flex gap-3">
                            <Button variant="ghost" onClick={() => setShowOrdonnanceModal(false)} className="rounded-xl font-bold h-12 px-6">Annuler</Button>
                            <Button variant="secondary" onClick={() => setShowPatientPicker(true)} className="rounded-xl font-bold h-12 px-6">Ajouter au patient</Button>
                            <Button variant="outline" onClick={() => handlePrintOrdonnance({ ...ordonnanceForm, prescription_date: ordonnanceForm.date })} className="rounded-xl font-black h-12 px-10 border-primary text-primary hover:bg-primary/5 shadow-lg shadow-primary/10 flex-1 sm:flex-none">
                                <Printer className="h-5 w-5 mr-3" /> Imprimer l'Ordonnance
                            </Button>
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* PATIENT PICKER MODAL */}
            <Dialog open={showPatientPicker} onOpenChange={setShowPatientPicker}>
                <DialogContent className="max-w-3xl rounded-[2rem] p-6">
                    <DialogHeader>
                        <DialogTitle className="text-lg font-black">Ajouter l'ordonnance au dossier patient</DialogTitle>
                        <DialogDescription>Rechercher par téléphone ou nom, puis sélectionner un patient.</DialogDescription>
                    </DialogHeader>

                    <div className="mt-4 space-y-4">
                        <div className="flex gap-2 items-center">
                            <div className="relative flex-1">
                                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                <Input
                                    placeholder="Recherche par téléphone ou nom..."
                                    value={patientQuery}
                                    onChange={e => setPatientQuery(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && searchPatients(patientQuery)}
                                    className="pl-10 h-12 rounded-xl"
                                />
                            </div>
                            <Button onClick={() => searchPatients(patientQuery)} className="rounded-xl h-12 px-6">Rechercher</Button>
                        </div>

                        <div className="max-h-64 overflow-y-auto space-y-2">
                            {patientLoading ? (
                                <div className="p-4">Chargement...</div>
                            ) : patientResults.length === 0 ? (
                                <div className="p-4 text-sm text-slate-500">Aucun résultat</div>
                            ) : (
                                patientResults.map(p => (
                                    <div key={p.id} className="p-3 rounded-xl bg-white border shadow-sm flex items-center justify-between">
                                        <div>
                                            <div className="font-bold text-sm">{p.client_name}</div>
                                            <div className="text-xs text-slate-400">{p.phone} • {p.client_email || ''}</div>
                                        </div>
                                        <div>
                                            <Button onClick={() => addToPatient(p)} className="rounded-xl">Sélectionner</Button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* ADD NEW MEDICATION MODAL */}
            <Dialog open={showNewMedModal} onOpenChange={setShowNewMedModal}>
                <DialogContent className="max-w-md rounded-[2.5rem] p-0 border-none shadow-2xl overflow-hidden bg-white z-[100]">
                    <DialogHeader className="p-8 border-b bg-slate-50/50">
                        <DialogTitle className="text-xl font-black italic text-primary flex items-center gap-2">
                            <Pill className="h-6 w-6" /> Nouveau Médicament
                        </DialogTitle>
                    </DialogHeader>
                    <div className="p-8 space-y-6">
                        <div className="space-y-2">
                            <label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Nom du médicament*</label>
                            <Input placeholder="Ex: Paraceamol 500mg" value={newMedForm.name} onChange={e => setNewMedForm({ ...newMedForm, name: e.target.value })} className="h-12 rounded-2xl border-slate-200 font-bold" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Dosage Défaut</label>
                                <Input placeholder="1 cp" value={newMedForm.default_dosage} onChange={e => setNewMedForm({ ...newMedForm, default_dosage: e.target.value })} className="h-12 rounded-2xl border-slate-200 font-bold" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Durée Défaut</label>
                                <Input placeholder="7 jours" value={newMedForm.default_duration} onChange={e => setNewMedForm({ ...newMedForm, default_duration: e.target.value })} className="h-12 rounded-2xl border-slate-200 font-bold" />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Fréquence</label>
                                <Input type="number" value={newMedForm.default_frequency_count} onChange={e => setNewMedForm({ ...newMedForm, default_frequency_count: parseInt(e.target.value) })} className="h-12 rounded-2xl border-slate-200 font-bold" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Moment</label>
                                <Select value={newMedForm.default_timing} onValueChange={v => setNewMedForm({ ...newMedForm, default_timing: v })}>
                                    <SelectTrigger className="h-12 rounded-2xl border-slate-200 font-bold"><SelectValue /></SelectTrigger>
                                    <SelectContent className="rounded-2xl z-[110] bg-white shadow-2xl">
                                        <SelectItem value="avant">Avant repas</SelectItem>
                                        <SelectItem value="apres">Après repas</SelectItem>
                                        <SelectItem value="soir">Le soir</SelectItem>
                                        <SelectItem value="à jeun">À jeun</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>
                    <DialogFooter className="p-8 border-t bg-slate-50/50 gap-3">
                        <Button variant="ghost" onClick={() => setShowNewMedModal(false)} className="rounded-xl font-bold h-12">Annuler</Button>
                        <Button onClick={handleCreateMedication} disabled={creatingMed} className="rounded-xl font-black h-12 px-8 bg-primary text-white shadow-xl shadow-primary/20">
                            {creatingMed ? 'Création...' : 'Ajouter au catalogue'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default MedecinDashboard;
