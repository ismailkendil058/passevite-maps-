import { useEffect, useMemo, useState } from 'react';
import { format, isBefore, startOfDay } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  MapPin,
  PhoneCall,
  Sparkles,
  Star,
  Menu,
  X,
  Instagram,
  ChevronRight,
  ArrowRight,
  ShoppingBag,
  MessageCircle,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent } from '@/components/ui/card';
import { Carousel, CarouselContent, CarouselItem, type CarouselApi } from '@/components/ui/carousel';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger } from '@/components/ui/drawer';
import { useIsMobile } from '@/hooks/use-mobile';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const clinic = {
  name: 'PasseVite',
  location: 'Cite 08maib1945, bt17a, Bab Ezzouar, Alger',
  phone: '0554 02 97 32',
  mapsUrl:
    'https://www.google.com/maps/place/PasseVite+clinic/@36.7330258,3.1823368,17z/data=!3m1!4b1!4m6!3m5!1s0x128e51b9024248bb:0x43393ad9f6d0a5d0!8m2!3d36.7330258!4d3.1849117!16s%2Fg%2F11yqq_fn1g?entry=ttu&g_ep=EgoyMDI2MDQyMS4wIKXMDSoASAFQAw%3D%3D',
};

const services = [
  { name: 'Implantologie', icon: Sparkles },
  { name: 'Orthodontie', icon: Star },
  { name: 'Blanchiment LED', icon: Sparkles },
  { name: 'Facettes Esthétiques', icon: Sparkles },
  { name: 'Chirurgie Orale', icon: Sparkles },
  { name: 'Soins & Prévention', icon: Star },
];

const timeSlots = [
  '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
  '12:00', '12:30', '13:00', '13:30', '14:00', '14:30',
  '15:00', '15:30', '16:00', '16:30', '17:00'
];

const Website = () => {
  const isMobile = useIsMobile();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [introStage, setIntroStage] = useState<'showing' | 'fading' | 'hidden'>('showing');

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [selectedTime, setSelectedTime] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const timer1 = setTimeout(() => setIntroStage('fading'), 4300);
    const timer2 = setTimeout(() => setIntroStage('hidden'), 5300);
    return () => { clearTimeout(timer1); clearTimeout(timer2); };
  }, []);

  const bookingSummary = useMemo(() => {
    if (!selectedDate || !selectedTime) return null;
    return `${format(selectedDate, 'EEEE d MMMM yyyy', { locale: fr })} à ${selectedTime}`;
  }, [selectedDate, selectedTime]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!fullName.trim() || !phone.trim() || !selectedDate || !selectedTime) {
      toast.error('Veuillez remplir tous les champs');
      return;
    }

    setIsSubmitting(true);

    try {
      const [hours, minutes] = selectedTime.split(':');
      const appointmentAt = new Date(selectedDate);
      appointmentAt.setHours(parseInt(hours), parseInt(minutes), 0, 0);

      const { error } = await (supabase as any)
        .from('website')
        .insert([{
          client_name: fullName,
          client_phone: phone,
          appointment_at: appointmentAt.toISOString(),
          status: 'scheduled',
          notes: 'Source: Website'
        }]);

      if (error) throw error;

      setIsSubmitted(true);
      toast.success('Demande enregistrée avec succès');
    } catch (error) {
      console.error('Error submitting appointment:', error);
      toast.error('Erreur lors de la réservation. Veuillez réessayer.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F7FD] text-[#1F1F3D] font-sans selection:bg-[#5C5CD6]/30 overflow-x-hidden">
      {/* Intro Overlay */}
      {introStage !== 'hidden' && (
        <div
          className={cn(
            "fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#F7F7FD] transition-opacity duration-1000",
            introStage === 'fading' ? 'opacity-0 pointer-events-none' : 'opacity-100'
          )}
        >
          <div className="flex flex-col items-center justify-center h-full w-full max-w-lg px-6 gap-12">
            <div className="relative animate-fade-in flex flex-col items-center gap-10">
              <img
                src="/VitalWeb.png"
                alt="PasseVite Logo"
                className="h-24 sm:h-32 opacity-90 animate-float"
                style={{ animationDuration: '4s' }}
              />
              <div className="text-center space-y-6 animate-slide-up" style={{ animationDelay: '0.5s', animationFillMode: 'both' }}>
                <h2 className="flex flex-col text-[#1F1F3D]">
                  <span className="font-serif text-xl sm:text-3xl font-light tracking-widest uppercase mb-2">Bienvenue chez</span>
                  <span className="font-serif text-[4.5rem] sm:text-[7rem] leading-[0.8] font-bold tracking-tighter lowercase">passevite</span>
                </h2>
                <p className="font-serif text-xl sm:text-3xl text-[#4A4A4A] italic font-light opacity-90">
                  L'excellence dentaire & orthodontique <br /> au cœur d'Alger
                </p>
              </div>
            </div>
            <div className="w-48 h-[1px] bg-[#5C5CD6]/20 mt-8 overflow-hidden rounded-full animate-fade-in" style={{ animationDelay: '1.2s', animationFillMode: 'both' }}>
              <div className="h-full bg-[#1F1F3D] animate-pan" style={{ width: '40%', animationDuration: '1.5s' }} />
            </div>
          </div>
        </div>
      )}

      {/* Glassmorphic Nav */}
      <nav className="fixed top-6 left-1/2 z-50 -translate-x-1/2 w-[90%] max-w-5xl rounded-full border border-white/10 bg-white/5 backdrop-blur-xl px-6 py-3 sm:px-8">
        <div className="flex items-center justify-center gap-3 py-1">
          <img src="/VitalWeb.png" className="h-6 sm:h-8 w-auto brightness-0 invert opacity-60" alt="Logo" />
          <span className="font-serif text-lg font-bold tracking-tight text-white uppercase">PASSEVITE</span>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative h-screen w-full overflow-hidden">
        <div className="relative h-full w-full">
          <img
            src="/DentalHero.png"
            alt="Clinic Hero"
            className="absolute h-full w-full object-cover grayscale-[0.1] sepia-[0.05] animate-pan"
          />
          <div className="absolute inset-0 bg-black/10" />
        </div>

        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center text-white text-center px-6">
          <div className="space-y-12 sm:space-y-16 animate-slide-up">
            <h1 className="font-serif text-[6rem] sm:text-[15rem] md:text-[22rem] lg:text-[26rem] leading-[0.8] font-bold tracking-tighter select-none drop-shadow-2xl">
              passevite
            </h1>
            <div className="space-y-10 sm:space-y-12">
              <p className="font-serif text-2xl sm:text-4xl md:text-5xl font-light italic tracking-tight opacity-95 max-w-[90vw] sm:max-w-4xl mx-auto leading-tight">
                Votre sourire, notre priorité. L'excellence dentaire à Alger.
              </p>
              <div className="pt-4 sm:pt-8">
                <Button asChild className="h-16 sm:h-20 px-10 sm:px-16 rounded-full bg-white text-[#1F1F3D] text-lg sm:text-xl font-medium hover:bg-[#5C5CD6] hover:text-white transition-all shadow-2xl border-none">
                  <a href="#booking" className="flex items-center gap-2">
                    <span>Prendre Rendez-vous</span>
                    <span className="opacity-70 text-sm">/ احجز الآن</span>
                  </a>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-7xl px-6 py-12 sm:py-16">
        {/* Big Text Section */}
        <section className="relative py-24 sm:py-32 text-center overflow-hidden">
          <h2 className="font-serif text-[18vw] leading-[0.7] font-bold tracking-tighter text-[#5C5CD6]/10 select-none uppercase">
            Sourire Parfait
          </h2>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full space-y-6 px-6">
            <h3 className="font-serif text-4xl sm:text-6xl font-light">Odontologie & <br /> <span className="italic">Dentisterie</span> Esthétique</h3>
            <p className="max-w-xl mx-auto text-sm sm:text-base text-[#4A4A4A] font-light leading-relaxed">
              Nos chirurgiens-dentistes utilisent des technologies de pointe pour sublimer votre sourire tout en préservant votre santé bucco-dentaire au quotidien.
            </p>
          </div>
        </section>

        {/* Combined Booking Section */}
        <section id="booking" className="grid gap-16 lg:grid-cols-[1fr_minmax(400px,0.8fr)] items-start pt-20">
          <div className="space-y-12 text-center lg:text-left">
            <div className="space-y-6">
              <h2 className="font-serif text-6xl sm:text-8xl font-light leading-tight">
                Planifiez votre <br /><span className="italic">consultation</span>
                <span className="block text-2xl sm:text-4xl mt-6 opacity-30">تحديد موعدك الطبي</span>
              </h2>
              <p className="max-w-md mx-auto lg:mx-0 text-base sm:text-lg text-[#4A4A4A] font-light leading-relaxed">
                Offrez à votre sourire l'expertise qu'il mérite. Réservez votre séance d'exception en quelques clics.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-8 pt-8">
              {services.map((s, i) => (
                <div key={i} className="flex flex-col items-center lg:items-start gap-3 group">
                  <div className="h-10 w-10 rounded-full bg-[#5C5CD6]/5 flex items-center justify-center text-[#5C5CD6] group-hover:bg-[#5C5CD6] group-hover:text-white transition-colors">
                    <s.icon className="h-5 w-5" />
                  </div>
                  <span className="text-xs font-bold uppercase tracking-widest text-[#1F1F3D]">{s.name}</span>
                </div>
              ))}
            </div>
          </div>

          <Card className="overflow-hidden rounded-[3rem] border-none bg-white shadow-2xl shadow-[#5C5CD6]/10">
            <CardContent className="p-8 sm:p-12">
              {!isSubmitted ? (
                <form className="space-y-8" onSubmit={handleSubmit}>
                  <div className="space-y-2 text-center">
                    <Label className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#5C5CD6]">Nom Complet / الاسم الكامل</Label>
                    <Input
                      value={fullName}
                      onChange={e => setFullName(e.target.value)}
                      className="bg-transparent border-0 border-b border-[#5C5CD6]/20 px-0 rounded-none h-10 text-base text-center focus-visible:ring-0 focus-visible:border-[#5C5CD6] transition-all placeholder:text-gray-300"
                      placeholder="Votre nom complet"
                      required
                    />
                  </div>
                  <div className="space-y-2 text-center">
                    <Label className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#5C5CD6]">Téléphone / رقم الهاتف</Label>
                    <Input
                      type="tel"
                      value={phone}
                      onChange={e => setPhone(e.target.value)}
                      className="bg-transparent border-0 border-b border-[#5C5CD6]/20 px-0 rounded-none h-10 text-base text-center focus-visible:ring-0 focus-visible:border-[#5C5CD6] transition-all placeholder:text-gray-300"
                      placeholder="05XX XX XX XX"
                      required
                    />
                  </div>

                  <div className="space-y-8">
                    <div className="space-y-4">
                      <Label className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#5C5CD6]">Date de Consultation / تاريخ الاستشارة</Label>
                      <div className="flex justify-center bg-[#5C5CD6]/5 rounded-3xl p-4">
                        <Calendar
                          mode="single"
                          selected={selectedDate}
                          onSelect={setSelectedDate}
                          disabled={(date) => isBefore(date, startOfDay(new Date()))}
                          className="bg-transparent"
                        />
                      </div>
                    </div>

                    <div className="space-y-4 text-center">
                      <Label className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#5C5CD6]">Heure Souhaitée / الوقت المفضل</Label>
                      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                        {timeSlots.map(t => (
                          <button
                            key={t}
                            type="button"
                            onClick={() => setSelectedTime(t)}
                            className={cn(
                              "h-10 rounded-xl text-xs transition-all border",
                              selectedTime === t ? "bg-[#5C5CD6] border-[#5C5CD6] text-white" : "bg-white border-[#5C5CD6]/10 text-[#1F1F3D] hover:bg-[#5C5CD6]/5"
                            )}
                          >
                            {t}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <Button type="submit" disabled={isSubmitting} className="h-20 sm:h-20 w-full rounded-full bg-[#1F1F3D] text-white text-lg font-bold hover:bg-[#5C5CD6] transition-all shadow-xl shadow-black/10 flex-col gap-0 uppercase tracking-widest">
                    <span>{isSubmitting ? 'Traitement...' : 'Confirmer'}</span>
                  </Button>
                </form>
              ) : (
                <div className="text-center py-12 space-y-8 animate-fade-in">
                  <div className="mx-auto h-24 w-24 rounded-full bg-[#5C5CD6]/10 flex items-center justify-center text-[#5C5CD6]">
                    <CheckCircle2 className="h-12 w-12" />
                  </div>
                  <div className="space-y-6">
                    <h3 className="font-serif text-5xl">Merci. <span className="block mt-2 text-3xl opacity-40">شكراً لك</span></h3>
                    <p className="text-[#4A4A4A] leading-relaxed max-w-md mx-auto text-lg">
                      Nous vous contacterons au <strong>{phone}</strong> pour confirmer votre consultation du {bookingSummary}.
                    </p>
                  </div>
                  <Button variant="outline" onClick={() => setIsSubmitted(false)} className="rounded-full border-[#5C5CD6] text-[#5C5CD6] px-12 h-14 font-bold">
                    Nouvelle Réservation
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-white py-12 text-center">
        <div className="mx-auto max-w-7xl px-6 lg:px-10">
          <div className="grid gap-8 sm:grid-cols-2 border-b border-[#F7F7FD] pb-12 mb-10">
            <div className="space-y-4 flex flex-col items-center">
              <span className="font-serif text-4xl font-bold tracking-tighter">passevite</span>
              <p className="text-xs text-[#7A7A7A] leading-relaxed max-w-[280px]">
                Clinique dentaire et orthodontique de prestige au cœur de Bab Ezzouar.
              </p>
            </div>
            <div className="space-y-4 flex flex-col items-center">
              <h4 className="text-sm font-bold uppercase tracking-[0.4em] text-[#5C5CD6]">Suivez-nous</h4>
              <div className="flex justify-center gap-8">
                <a href="https://instagram.com/passevite_clinic" target="_blank" rel="noopener noreferrer" className="transition-transform hover:scale-125">
                  <Instagram className="h-6 w-6 text-[#1F1F3D] hover:text-[#5C5CD6] transition-colors" />
                </a>
                <a href="https://wa.me/213554029732" target="_blank" rel="noopener noreferrer" className="transition-transform hover:scale-125">
                  <MessageCircle className="h-6 w-6 text-[#1F1F3D] hover:text-[#5C5CD6] transition-colors" />
                </a>
              </div>
            </div>
          </div>

          {/* Maps Card */}
          <div className="mb-10 flex justify-center px-4">
            <div
              className="group w-full max-w-2xl overflow-hidden rounded-[2.5rem] bg-[#5C5CD6]/5 border border-[#5C5CD6]/10 p-1.5 transition-all hover:bg-[#5C5CD6]/10 hover:border-[#5C5CD6]/20"
            >
              <div className="relative aspect-square w-full overflow-hidden rounded-[2.2rem] bg-[#E5E1DC]">
                <iframe
                  src="https://maps.google.com/maps?q=36.7330258,3.1849117&t=&z=16&ie=UTF8&iwloc=&output=embed"
                  width="100%"
                  height="100%"
                  style={{ border: 0 }}
                  allowFullScreen
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  className="absolute inset-0 grayscale-[0.2] contrast-125 group-hover:grayscale-0 transition-all duration-700"
                />
              </div>
            </div>
          </div>

          <p className="text-[10px] uppercase tracking-[0.4em] text-[#A0A0A0] font-medium">
            &copy; {new Date().getFullYear()} PasseVite Clinic. Excellence Dentaire.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Website;
