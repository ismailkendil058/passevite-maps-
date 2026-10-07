import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

export interface QueueEntry {
  id: string;
  session_id: string;
  phone: string;
  patient_name?: string;
  state: 'U' | 'N' | 'R';
  doctor_id: string;
  state_number: number;
  client_id: string;
  position: number;
  status: 'waiting' | 'in_cabinet' | 'ready_for_reception' | 'completed';
  appointment_id?: string;
  created_at: string;
  doctor?: { name: string; initial: string };
  treatment?: string;
  total_amount?: number;
  handoff_notes?: string;
}

export interface Doctor {
  id: string;
  name: string;
  initial: string;
}

export interface ActiveSession {
  id: string;
  opened_at: string;
  is_active: boolean;
}

export function useQueue() {
  const [entries, setEntries] = useState<QueueEntry[]>([]);
  const [inCabinetEntries, setInCabinetEntries] = useState<QueueEntry[]>([]);
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(null);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);

  const removeEntryFromState = useCallback((entryId: string) => {
    setEntries(prev => prev.filter(e => e.id !== entryId));
    setInCabinetEntries(prev => prev.filter(e => e.id !== entryId));
  }, []);

  const isQueueEntryCompletionConflict = (error: { code?: string; message?: string; details?: string; hint?: string } | null) => {
    if (!error || (error.code !== '23503' && error.code !== '23505')) {
      return false;
    }

    const text = `${error.message ?? ''} ${error.details ?? ''} ${error.hint ?? ''}`.toLowerCase();
    return text.includes('queue_entry_id') || text.includes('completed_clients_queue_entry_id_fkey');
  };

  const fetchDoctors = useCallback(async () => {
    const { data } = await supabase.from('doctors').select('*');
    if (data) setDoctors(data);
  }, []);

  const fetchActiveSession = useCallback(async () => {
    const { data } = await supabase
      .from('sessions')
      .select('*')
      .eq('is_active', true)
      .order('opened_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    setActiveSession(data);
    return data;
  }, []);

  const fetchEntries = useCallback(async (sessionId: string) => {
    const { data } = await supabase
      .from('queue_entries')
      .select('*, doctor:doctors(*)')
      .eq('session_id', sessionId)
      .eq('status', 'waiting')
      .order('created_at', { ascending: true });
    if (data) {
      const sorted = sortByPriority(data as QueueEntry[]);
      setEntries(sorted);
    }
  }, []);

  const fetchInCabinetEntries = useCallback(async (sessionId: string) => {
    const { data } = await supabase
      .from('queue_entries')
      .select('*, doctor:doctors(*)')
      .eq('session_id', sessionId)
      .in('status', ['in_cabinet', 'ready_for_reception'])
      .order('created_at', { ascending: true });
    if (data) {
      setInCabinetEntries(data as QueueEntry[]);
    }
  }, []);

  const handoffConsultation = async (
    entryId: string,
    data: { treatment: string; total_amount: number; handoff_notes: string }
  ) => {
    console.log('Handoff triggered for:', entryId, data);
    const { error } = await supabase
      .from('queue_entries')
      .update({
        treatment: data.treatment,
        total_amount: data.total_amount,
        handoff_notes: data.handoff_notes,
        status: 'ready_for_reception'
      } as any)
      .eq('id', entryId);

    if (error) {
      console.error('Handoff DB error:', error);
    }

    if (!error && activeSession) {
      await fetchInCabinetEntries(activeSession.id);
    }
    return { error };
  };

  const sortByPriority = (items: QueueEntry[]) => {
    return [...items].sort((a, b) => {
      // 1. U (Urgent) always has absolute priority
      if (a.state === 'U' && b.state !== 'U') return -1;
      if (a.state !== 'U' && b.state === 'U') return 1;
      if (a.state === 'U' && b.state === 'U') return a.state_number - b.state_number;

      // 2. For N (Nouveau) and R (Rendez-vous), sort strictly chronologically by arrival time
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });
  };

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      // Batch initial fetches for faster load
      const [docRes, session] = await Promise.all([
        supabase.from('doctors').select('*'),
        fetchActiveSession()
      ]);

      // If no doctors exist in DB, seed default teams
      if (!docRes.data || docRes.data.length === 0) {
        try {
          const defaultDoctors = [
            { name: 'Djihane', initial: 'D' },
            { name: 'Zineb', initial: 'Z' },
            { name: 'Imane', initial: 'I' },
          ];
          const insertRes = await supabase.from('doctors').insert(defaultDoctors).select('*');
          if (insertRes.data) setDoctors(insertRes.data as Doctor[]);
        } catch (err) {
          // fallback: keep empty
          if (docRes.data) setDoctors(docRes.data);
        }
      } else {
        setDoctors(docRes.data);
      }

      if (session) {
        await Promise.all([
          fetchEntries(session.id),
          fetchInCabinetEntries(session.id)
        ]);
      }
      setLoading(false);
    };
    init();
  }, [fetchActiveSession, fetchEntries, fetchInCabinetEntries]);

  // Combined Real-time subscription for queue entries
  useEffect(() => {
    if (!activeSession) return;

    let timeoutId: ReturnType<typeof setTimeout>;

    const channel = supabase
      .channel(`queue-${activeSession.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'queue_entries',
        },
        (payload) => {
          // Re-verify if the change belongs to this session if possible, 
          // otherwise refetch to be safe.
          const sessionId = (payload.new as any)?.session_id || (payload.old as any)?.session_id;
          if (!sessionId || sessionId === activeSession.id) {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => {
              fetchEntries(activeSession.id);
              fetchInCabinetEntries(activeSession.id);
            }, 300); // Debounce rapidly chained real-time events
          }
        }
      )
      .subscribe();

    return () => {
      clearTimeout(timeoutId);
      supabase.removeChannel(channel);
    };
  }, [activeSession?.id, fetchEntries, fetchInCabinetEntries]);

  // Session real-time
  useEffect(() => {
    const channel = supabase
      .channel('session-monitor')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sessions' },
        (payload) => {
          if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
            fetchActiveSession();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchActiveSession]);

  const openSession = async (userId: string) => {
    // Close any active sessions first
    await supabase.from('sessions').update({ is_active: false, closed_at: new Date().toISOString() }).eq('is_active', true);
    const { data, error } = await supabase
      .from('sessions')
      .insert({ opened_by: userId })
      .select()
      .single();
    if (data) {
      setActiveSession(data);
      setEntries([]);
    }
    return { data, error };
  };

  const closeSession = async () => {
    if (!activeSession) return { error: new Error('Aucune séance active') };
    const { error } = await supabase
      .from('sessions')
      .update({ is_active: false, closed_at: new Date().toISOString() })
      .eq('id', activeSession.id);
    if (!error) {
      setActiveSession(null);
      setEntries([]);
      setInCabinetEntries([]);
    }
    return { error };
  };

  // Call client - move from waiting to in_cabinet
  const callClient = async (entryId: string) => {
    const { error } = await supabase
      .from('queue_entries')
      .update({ status: 'in_cabinet' })
      .eq('id', entryId);

    if (!error && activeSession) {
      // Immediate local update
      fetchEntries(activeSession.id);
      fetchInCabinetEntries(activeSession.id);
    }
    return { error };
  };

  // Return client to waiting queue from in_cabinet
  const returnToQueue = async (entryId: string) => {
    const { error } = await supabase
      .from('queue_entries')
      .update({ status: 'waiting' })
      .eq('id', entryId);

    if (!error && activeSession) {
      fetchEntries(activeSession.id);
      fetchInCabinetEntries(activeSession.id);
    }
    return { error };
  };

  const addClient = async (phone: string, state: 'U' | 'N' | 'R', doctorId: string, patientName?: string, appointmentId?: string, isExistingPatient?: boolean) => {
    if (!activeSession) return { error: new Error('Aucune séance active') };

    const doctor = doctors.find(d => d.id === doctorId);
    if (!doctor) return { error: new Error('Docteur introuvable') };

    // Get next number for this state in current session by checking BOTH tables
    const [qRes, cRes] = await Promise.all([
      supabase
        .from('queue_entries')
        .select('state_number')
        .eq('session_id', activeSession.id)
        .eq('state', state)
        .order('state_number', { ascending: false })
        .limit(1),
      supabase
        .from('completed_clients')
        .select('id')
        .eq('session_id', activeSession.id)
        .eq('state', state)
    ]);

    let maxNumber = 0;

    // Max from queue_entries
    if (qRes.data && qRes.data.length > 0) {
      maxNumber = qRes.data[0].state_number;
    }

    // Use count of completed clients as a fallback/offset to keep numbers progressive
    if (cRes.data && cRes.data.length > 0) {
      if (cRes.data.length > maxNumber) {
        maxNumber = cRes.data.length;
      }
    }

    const nextNumber = maxNumber + 1;
    let clientId = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    if (isExistingPatient || appointmentId) {
      const { data: existingClient, error: existingClientError } = await supabase
        .from('completed_clients')
        .select('client_id')
        .eq('phone', phone.trim())
        .not('client_id', 'is', null)
        .order('completed_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingClientError) return { error: existingClientError };

      clientId = existingClient?.client_id || phone.trim();
    }
    const position = entries.length + 1;

    const { data, error } = await supabase
      .from('queue_entries')
      .insert({
        session_id: activeSession.id,
        phone: phone.trim(),
        patient_name: patientName?.trim(),
        state,
        doctor_id: doctorId,
        state_number: nextNumber,
        client_id: clientId,
        position,
        appointment_id: appointmentId,
      })
      .select('*, doctor:doctors(*)')
      .single();

    if (error) {
      console.error("=======================");
      console.error("EXACT DATABASE ERROR:");
      console.error("Code:", error.code);
      console.error("Message:", error.message);
      console.error("Details:", error.details);
      console.error("Hint:", error.hint);
      console.error("=======================");
    }

    if (appointmentId) {
      // Mark appointment as 'attended' when patient is added to queue
      await supabase.from('appointments').update({ status: 'attended' }).eq('id', appointmentId);
    }

    if (data && !error) {
      setEntries(prev => sortByPriority([...prev, data as QueueEntry]));
    }

    return { data, error };
  };

  const completeClient = async (
    entryId: string,
    clientName: string,
    treatment: string,
    totalAmount: number,
    tranchePaid: number,
    receptionistId: string,
    notes?: string
  ) => {
    // Find entry from either waiting or in_cabinet list
    const entry = entries.find(e => e.id === entryId) || inCabinetEntries.find(e => e.id === entryId);
    if (!entry || !activeSession) return { error: new Error('Entrée introuvable') };

    // Check if this queue entry still exists (prevents duplicate completion on double-click)
    const { data: queueEntry } = await supabase
      .from('queue_entries')
      .select('id')
      .eq('id', entryId)
      .maybeSingle();

    if (!queueEntry) {
      // Already completed — just clean up local state
      removeEntryFromState(entryId);
      return { error: null, alreadyCompleted: true };
    }

    // NOTE: Do NOT set queue_entry_id here — the FK on completed_clients
    // references queue_entries and will BLOCK the delete of the queue entry below.
    const insertData: any = {
      session_id: activeSession.id,
      client_name: clientName.trim(),
      phone: entry.phone,
      doctor_id: entry.doctor_id,
      client_id: entry.client_id,
      state: entry.state,
      treatment,
      total_amount: totalAmount,
      tranche_paid: tranchePaid,
      receptionist_id: receptionistId,
      notes: notes?.trim() || null,
    };

    let { error: insertError } = await supabase.from('completed_clients').insert(insertData);

    // If we hit the inherited receptionist_id foreign key constraint from auth.users (due to custom roles migration)
    if (insertError && insertError.code === '23503' && insertError.message?.includes('receptionist_id')) {
      insertData.receptionist_id = 'a44e7e83-189f-4f82-96d8-b0eeea4ab104';
      const retry = await supabase.from('completed_clients').insert(insertData);
      insertError = retry.error;
    }

    if (insertError) {
      // Handle any conflict/duplicate error gracefully
      if (insertError.code === '23505' || isQueueEntryCompletionConflict(insertError)) {
        await supabase.from('queue_entries').delete().eq('id', entryId);
        removeEntryFromState(entryId);
        return { error: null, alreadyCompleted: true };
      }

      return { error: insertError, alreadyCompleted: false };
    }

    if (entry.appointment_id) {
      await supabase.from('appointments').update({ status: 'attended' }).eq('id', entry.appointment_id);
    }

    // Delete from queue_entries — this now works because completed_clients
    // does NOT reference this row via queue_entry_id
    const { error } = await supabase
      .from('queue_entries')
      .delete()
      .eq('id', entryId);

    if (!error) {
      removeEntryFromState(entryId);
    } else {
      // If delete fails for any reason, still remove from local state
      // so the UI is not stuck. The realtime subscription will reconcile.
      removeEntryFromState(entryId);
    }

    return { error: null, alreadyCompleted: false };
  };

  const getStats = () => {
    const stats = { U: { current: 0, total: 0 }, N: { current: 0, total: 0 }, R: { current: 0, total: 0 } };
    const waiting = entries.filter(e => e.status === 'waiting');

    (['U', 'N', 'R'] as const).forEach(state => {
      const stateEntries = waiting.filter(e => e.state === state);
      stats[state].current = stateEntries.length > 0 ? stateEntries[0].state_number : 0;
      stats[state].total = stateEntries.length;
    });

    return stats;
  };

  const updateClient = async (entryId: string, updates: { phone?: string; state?: 'U' | 'N' | 'R'; doctor_id?: string; patient_name?: string }) => {
    const { error } = await supabase
      .from('queue_entries')
      .update(updates)
      .eq('id', entryId);

    if (!error && activeSession) {
      fetchEntries(activeSession.id);
      fetchInCabinetEntries(activeSession.id);
    }
    return { error };
  };

  const deleteClient = async (entryId: string) => {
    const { error } = await supabase
      .from('queue_entries')
      .delete()
      .eq('id', entryId);

    if (!error) {
      setEntries(prev => prev.filter(e => e.id !== entryId));
      setInCabinetEntries(prev => prev.filter(e => e.id !== entryId));
    }
    return { error };
  };

  const updateCompletedClient = async (id: string, updates: any) => {
    const { error } = await supabase
      .from('completed_clients')
      .update(updates)
      .eq('id', id);
    return { error };
  };

  const deleteCompletedClient = async (id: string) => {
    const { error } = await supabase
      .from('completed_clients')
      .delete()
      .eq('id', id);
    return { error };
  };

  return {
    entries,
    inCabinetEntries,
    activeSession,
    doctors,
    loading,
    openSession,
    closeSession,
    addClient,
    callClient,
    completeClient,
    handoffConsultation,
    getStats,
    fetchEntries,
    fetchInCabinetEntries,
    fetchActiveSession,
    updateClient,
    deleteClient,
    updateCompletedClient,
    deleteCompletedClient,
    returnToQueue,
  };
}
