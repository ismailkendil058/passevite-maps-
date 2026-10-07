import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
    Search, LogOut, FileText, Plus, X, Printer, User, Trash2, Home, ChevronLeft, ArrowLeft, Pill, ClipboardList, Clock, MessageSquare
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { toast } from 'sonner';
import { cn, getPersistentAuth } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';

const OrdonnancePage = () => {
    const navigate = useNavigate();
    const [doctorInfo, setDoctorInfo] = useState<{ id: string, name: string } | null>(null);
    const [prescriptions, setPrescriptions] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    // Modal State
    const [showModal, setShowModal] = useState(false);
    const [saving, setSaving] = useState(false);
    const [formData, setFormData] = useState({
        patient_name: '',
        age: '',
        date: format(new Date(), 'yyyy-MM-dd'),
        medications: [{ name: '', dosage: '', duree: '', frequency_count: 1, frequency_unit: 'comprimé(s)', timing: 'apres', instructions: '' }],
        notes: ''
    });

    // Medications Catalog
    const [dbMedications, setDbMedications] = useState<any[]>([]);
    const [showAddMedModal, setShowAddMedModal] = useState(false);
    const [newMedForm, setNewMedForm] = useState({
        name: '',
        dosage: '',
        duree: '',
        frequency_count: 1,
        frequency_unit: 'comprimé(s)',
        timing: 'apres'
    });

    useEffect(() => {
        const authData = getPersistentAuth('doctor_auth');
        if (authData) {
            setDoctorInfo(JSON.parse(authData));
        } else {
            navigate('/doctor/login');
        }
    }, [navigate]);

    const fetchData = async () => {
        if (!doctorInfo) return;
        setLoading(true);
        try {
            const { data: rxData } = await supabase
                .from('prescriptions')
                .select('*')
                .eq('doctor_id', doctorInfo.id)
                .order('created_at', { ascending: false });
            if (rxData) setPrescriptions(rxData);

            const { data: medData } = await supabase
                .from('medications')
                .select('*')
                .order('name');
            if (medData) setDbMedications(medData);
        } catch (err) {
            console.error(err);
            toast.error('Erreur de chargement');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (doctorInfo) fetchData();
    }, [doctorInfo]);

    const filteredPrescriptions = useMemo(() => {
        return prescriptions.filter(rx =>
            rx.patient_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            JSON.stringify(rx.medications).toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [prescriptions, searchQuery]);

    const handleSave = async () => {
        if (!doctorInfo) return;
        if (!formData.patient_name || formData.medications.some(m => !m.name)) {
            toast.error('Veuillez remplir le nom du patient et au moins un médicament');
            return;
        }

        setSaving(true);
        try {
            const { error } = await supabase.from('prescriptions').insert([{
                doctor_id: doctorInfo.id,
                patient_name: formData.patient_name,
                prescription_date: formData.date,
                medications: formData.medications as any,
                notes: formData.notes,
                age: formData.age ? parseInt(formData.age) : null
            }]);

            if (error) throw error;

            toast.success('Ordonnance créée');
            setShowModal(false);
            setFormData({
                patient_name: '',
                age: '',
                date: format(new Date(), 'yyyy-MM-dd'),
                medications: [{ name: '', dosage: '', duree: '', frequency_count: 1, frequency_unit: 'comprimé(s)', timing: 'apres', instructions: '' }],
                notes: ''
            });
            fetchData();
        } catch (err: any) {
            toast.error('Erreur: ' + err.message);
        } finally {
            setSaving(false);
        }
    };

    

    const addMedication = () => {
        setFormData({
            ...formData,
            medications: [...formData.medications, { name: '', dosage: '', duree: '', frequency_count: 1, frequency_unit: 'comprimé(s)', timing: 'apres', instructions: '' }]
        });
    };

    const removeMedication = (idx: number) => {
        if (formData.medications.length <= 1) return;
        const newMeds = [...formData.medications];
        newMeds.splice(idx, 1);
        setFormData({ ...formData, medications: newMeds });
    };

    const updateMedication = (idx: number, field: string, value: any) => {
        const newMeds = [...formData.medications];
        // @ts-ignore
        newMeds[idx][field] = value;
        setFormData({ ...formData, medications: newMeds });
    };

    const handlePrint = (rx: any) => {
        const printWindow = window.open('', '_blank');
        if (!printWindow) return;

        const medsHtml = rx.medications.map((m: any) => {
            const timingMap: Record<string, string> = {
                'avant': 'avant le repas',
                'apres': 'après le repas',
                'pendant': 'pendant le repas',
                'soir': 'le soir'
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
  body { background: transparent; font-family: 'Lato', sans-serif; }
  .page { width: 210mm; height: 297mm; background: #fff; padding: 10mm 15mm; display: flex; flex-direction: column; margin: 0 auto; position: relative; overflow: hidden; }
  .clinic-brand { text-align: center; font-family: 'Playfair Display', serif; font-size: 32pt; font-weight: 700; color: #3a9fd1; margin-bottom: 8mm; letter-spacing: 0.1em; text-transform: uppercase; }
  .top-row { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 5mm; border-bottom: 1px solid #f0f7fb; padding-bottom: 3mm; }
  .clinic-info { flex: 1; }
  .clinic-name { font-size: 14pt; font-weight: 700; color: #2a8bbf; margin-bottom: 1mm; }
  .doctor-title { font-size: 11pt; font-weight: 700; color: #2a8bbf; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 2mm; }
  .clinic-address { font-size: 9pt; font-weight: 300; color: #5ab0d8; line-height: 1.4; }
  .clinic-phone { font-size: 9pt; color: #2a8bbf; font-weight: 400; margin-top: 1mm; }
  .patient-fields { display: flex; flex-direction: column; gap: 3mm; min-width: 70mm; }
  .field-line { display: flex; align-items: baseline; gap: 6px; white-space: nowrap; }
  .field-label { font-weight: 700; font-size: 11pt; color: #2a8bbf; }
  .field-dots { flex: 1; min-width: 40mm; margin-bottom: 2px; padding-left: 3mm; font-size: 11pt; color: #333; font-weight: 400; }
  .ordonnance-title { text-align: center; font-size: 16pt; font-weight: 700; color: #1a6fa0; letter-spacing: 0.2em; text-decoration: underline; text-underline-offset: 5px; margin: 8mm 0 10mm 0; }
  .body-area { flex: 1; overflow: hidden; padding: 0 5mm; }
  @media print { body { background: white; } .page { margin: 0; box-shadow: none; } @page { size: A4; margin: 0; } }
</style>
</head>
<body>
<div class="page">
  <div class="clinic-brand">CD Dental Clinic</div>
  <div class="top-row">
    <div class="clinic-info">
      <div class="clinic-name">${doctorInfo?.name || 'Dr. Hakim'}</div>
      <div class="doctor-title">Chirurgien Dentiste</div>
      <div class="clinic-address">Zone Aissat Mustapha<br>Cité 90 lgts " ENCG " Bt 8<br>N° 01 Réghaia Alger</div>
      <div class="clinic-phone">0796 66 73 49 / 020 25 49 12</div>
    </div>
    <div class="patient-fields">
      <div class="field-line"><span class="field-label">Le :</span><span class="field-dots">${new Date(rx.prescription_date).toLocaleDateString('fr-FR')}</span></div>
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

    const handleDelete = async (id: string) => {
        try {
            const { error } = await supabase.from('prescriptions').delete().eq('id', id);
            if (error) throw error;
            toast.success('Supprimée');
            fetchData();
        } catch (err) {
            toast.error('Erreur');
        }
    };

    return (
        <div className="min-h-screen bg-[#f8fafc] flex flex-col">
            {/* Premium Header */}
            <header className="flex items-center justify-between p-4 border-b sticky top-0 bg-white/80 backdrop-blur-md z-20 shadow-sm">
                <div className="flex items-center gap-3">
                    <Button variant="ghost" size="icon" onClick={() => navigate('/doctor')} className="h-9 w-9 rounded-full">
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <div>
                        <h1 className="text-xl font-black text-slate-800 italic">Mes Ordonnances</h1>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Gestion des prescriptions</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <Button onClick={() => setShowModal(true)} className="rounded-xl h-10 px-5 shadow-lg shadow-primary/20 bg-primary hover:bg-primary/90 font-bold">
                        <Plus className="h-4 w-4 mr-2" /> Nouvelle
                    </Button>
                </div>
            </header>

            <main className="p-4 lg:p-8 max-w-7xl mx-auto w-full space-y-8">
                {/* Search & Filter */}
                <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                    <Input
                        placeholder="Rechercher par patient ou médicament..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="pl-12 h-14 bg-white border-none shadow-premium rounded-2xl text-lg font-medium"
                    />
                </div>

                {/* List Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {loading ? (
                        Array.from({ length: 6 }).map((_, i) => (
                            <div key={i} className="h-48 bg-white border border-slate-100 rounded-3xl animate-pulse" />
                        ))
                    ) : filteredPrescriptions.length === 0 ? (
                        <div className="col-span-full py-20 text-center bg-white rounded-3xl border border-dashed border-slate-200">
                            <FileText className="h-16 w-16 text-slate-100 mx-auto mb-4" />
                            <p className="text-slate-400 font-bold uppercase tracking-widest text-sm">Aucune ordonnance</p>
                        </div>
                    ) : (
                        filteredPrescriptions.map(rx => (
                            <Card key={rx.id} className="border-none shadow-premium bg-white group hover:shadow-xl transition-all rounded-3xl overflow-hidden">
                                <CardContent className="p-6">
                                    <div className="flex justify-between items-start mb-6">
                                        <div className="flex items-center gap-3">
                                            <div className="h-12 w-12 rounded-2xl bg-primary/5 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-all">
                                                <User className="h-6 w-6" />
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-slate-800 text-lg leading-tight">{rx.patient_name}</h3>
                                                <p className="text-xs text-slate-400 font-bold uppercase">{format(new Date(rx.prescription_date), 'dd MMM yyyy', { locale: fr })}</p>
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            <Button variant="ghost" size="icon" onClick={() => handlePrint(rx)} className="h-9 w-9 text-indigo-500 hover:bg-indigo-50 rounded-xl">
                                                <Printer className="h-5 w-5" />
                                            </Button>
                                            <AlertDialog>
                                                <AlertDialogTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="h-9 w-9 text-rose-500 hover:bg-rose-50 rounded-xl">
                                                        <Trash2 className="h-5 w-5" />
                                                    </Button>
                                                </AlertDialogTrigger>
                                                <AlertDialogContent className="rounded-3xl border-none shadow-2xl">
                                                    <AlertDialogHeader>
                                                        <AlertDialogTitle className="font-black italic text-rose-500">Supprimer l'ordonnance ?</AlertDialogTitle>
                                                        <AlertDialogDescription>Cette action est définitive.</AlertDialogDescription>
                                                    </AlertDialogHeader>
                                                    <AlertDialogFooter>
                                                        <AlertDialogCancel className="rounded-xl font-bold">Annuler</AlertDialogCancel>
                                                        <AlertDialogAction onClick={() => handleDelete(rx.id)} className="bg-rose-500 hover:bg-rose-600 rounded-xl font-bold">Supprimer</AlertDialogAction>
                                                    </AlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>
                                        </div>
                                    </div>

                                    <div className="space-y-2 pb-2">
                                        {rx.medications.slice(0, 3).map((m: any, i: number) => (
                                            <div key={i} className="flex justify-between items-center bg-slate-50/50 p-2 rounded-xl border border-slate-100/50">
                                                <span className="text-xs font-bold text-slate-600 truncate mr-2">{m.name}</span>
                                                <Badge variant="outline" className="text-[9px] bg-white text-slate-400 border-slate-100">{m.dosage}</Badge>
                                            </div>
                                        ))}
                                        {rx.medications.length > 3 && (
                                            <p className="text-[10px] text-primary font-black uppercase text-right pt-1">+{rx.medications.length - 3} médicaments</p>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        ))
                    )}
                </div>
            </main>

            {/* CREATION MODAL */}
            <Dialog open={showModal} onOpenChange={setShowModal}>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden rounded-[2.5rem] border-none shadow-2xl p-0 flex flex-col">
                    <DialogHeader className="p-8 border-b bg-slate-50/50 flex-shrink-0">
                        <DialogTitle className="text-2xl font-black italic text-primary flex items-center gap-3">
                            <FileText className="h-8 w-8" /> Nouvelle Ordonnance
                        </DialogTitle>
                    </DialogHeader>

                    <div className="flex-1 overflow-y-auto p-8 space-y-8">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="space-y-2">
                                <label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Date de prescription</label>
                                <Input type="date" value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} className="h-12 rounded-2xl border-slate-200 bg-slate-50 font-bold" />
                            </div>
                            <div className="md:col-span-1 space-y-2">
                                <label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Nom du patient *</label>
                                <Input placeholder="Nom et Prénom" value={formData.patient_name} onChange={e => setFormData({ ...formData, patient_name: e.target.value })} className="h-12 rounded-2xl border-slate-200 font-bold" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Âge</label>
                                <Input type="number" placeholder="--" value={formData.age} onChange={e => setFormData({ ...formData, age: e.target.value })} className="h-12 rounded-2xl border-slate-200 font-bold" />
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="flex justify-between items-center">
                                <h3 className="text-xs font-black italic text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                    <Pill className="h-4 w-4" /> Médicaments Prescrits
                                </h3>
                                <Button variant="outline" size="sm" onClick={addMedication} className="rounded-xl text-[10px] font-black uppercase tracking-widest h-9 border-primary/20 text-primary hover:bg-primary/5">
                                    <Plus className="h-4 w-4 mr-1.5" /> Ajouter un produit
                                </Button>
                            </div>

                            <div className="space-y-4">
                                {formData.medications.map((med, idx) => (
                                    <div key={idx} className="p-6 bg-slate-50/50 rounded-[2rem] border border-slate-200/50 relative group">
                                        {formData.medications.length > 1 && (
                                            <Button variant="ghost" size="icon" onClick={() => removeMedication(idx)} className="absolute -top-3 -right-3 h-8 w-8 rounded-full bg-white shadow-lg text-rose-500 hover:text-rose-600 hover:bg-rose-50 z-10 border border-slate-100">
                                                <X className="h-4 w-4" />
                                            </Button>
                                        )}

                                        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                                            <div className="md:col-span-4 space-y-1.5">
                                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Nom</label>
                                                <Select
                                                    value={med.name}
                                                    onValueChange={(val) => {
                                                        const m = dbMedications.find(x => x.name === val);
                                                        if (m) {
                                                            const newMeds = [...formData.medications];
                                                            newMeds[idx] = {
                                                                ...newMeds[idx],
                                                                name: m.name,
                                                                dosage: m.default_dosage || '',
                                                                duree: m.default_duration || '',
                                                                frequency_count: m.default_frequency_count || 1,
                                                                frequency_unit: m.default_frequency_unit || 'comprimé(s)',
                                                                timing: m.default_timing || 'apres'
                                                            };
                                                            setFormData({ ...formData, medications: newMeds });
                                                        }
                                                    }}
                                                >
                                                    <SelectTrigger className="h-11 rounded-xl border-slate-200 bg-white font-bold"><SelectValue placeholder="Choisir..." /></SelectTrigger>
                                                    <SelectContent className="max-h-64 rounded-2xl shadow-2xl border-none">
                                                        {dbMedications.map(m => <SelectItem key={m.id} value={m.name} className="font-bold py-2.5">{m.name}</SelectItem>)}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="md:col-span-2 space-y-1.5">
                                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Dose</label>
                                                <Input placeholder="1cp..." value={med.dosage} onChange={e => updateMedication(idx, 'dosage', e.target.value)} className="h-11 rounded-xl border-slate-200 bg-white font-bold" />
                                            </div>
                                            <div className="md:col-span-2 space-y-1.5">
                                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Durée</label>
                                                <Input placeholder="7 jours" value={med.duree} onChange={e => updateMedication(idx, 'duree', e.target.value)} className="h-11 rounded-xl border-slate-200 bg-white font-bold" />
                                            </div>
                                            <div className="md:col-span-1 space-y-1.5">
                                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Fréq.</label>
                                                <Input type="number" value={med.frequency_count} onChange={e => updateMedication(idx, 'frequency_count', parseInt(e.target.value))} className="h-11 rounded-xl border-slate-200 bg-white font-bold" />
                                            </div>
                                            <div className="md:col-span-3 space-y-1.5">
                                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Moment</label>
                                                <Select value={med.timing} onValueChange={v => updateMedication(idx, 'timing', v)}>
                                                    <SelectTrigger className="h-11 rounded-xl border-slate-200 bg-white font-bold"><SelectValue /></SelectTrigger>
                                                    <SelectContent className="rounded-2xl shadow-xl">
                                                        <SelectItem value="avant">Avant repas</SelectItem>
                                                        <SelectItem value="apres">Après repas</SelectItem>
                                                        <SelectItem value="soir">Le soir</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    <DialogFooter className="p-8 border-t bg-slate-50/50 flex-shrink-0 gap-3">
                        <Button variant="ghost" onClick={() => setShowModal(false)} className="rounded-xl font-bold h-12 px-6">Annuler</Button>
                        <Button variant="outline" onClick={() => handlePrint({ ...formData, prescription_date: formData.date })} className="rounded-xl font-bold h-12 px-6 border-slate-300">
                            <Printer className="h-5 w-5 mr-2" /> Imprimer
                        </Button>
                        <Button onClick={handleSave} disabled={saving} className="rounded-xl font-black h-12 px-10 shadow-xl shadow-primary/20">
                            {saving ? 'Enregistrement...' : 'Enregistrer Ordonnance'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>


        </div>
    );
};

export default OrdonnancePage;
