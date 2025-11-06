

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Patient, Appointment, Prescription, AppointmentStatus, PaymentStatus, MedicationItem, Payment } from './types';
import { STATUS_COLORS, PAYMENT_STATUS_COLORS, ICONS, DOCTOR_INFO, CLINIC_INFO } from './constants';
import Modal from './components/Modal';

import initialPatientsData from './data/patients.json';
import initialAppointmentsData from './data/appointments.json';
import initialPrescriptionsData from './data/prescriptions.json';

const initialPatients: Patient[] = initialPatientsData as Patient[];
const initialAppointments: Appointment[] = initialAppointmentsData as Appointment[];
const initialPrescriptions: Prescription[] = initialPrescriptionsData as Prescription[];


// --- FORMATTING HELPERS ---
const formatDate = (isoString?: string): string => {
    if (!isoString) return 'N/A';
    try {
        const date = new Date(isoString);
        if (isNaN(date.getTime())) return 'Invalid Date';
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${day}-${month}-${year}`;
    } catch (e) {
        return 'Invalid Date';
    }
};

const formatDateTime = (isoString?: string): string => {
    if (!isoString) return 'N/A';
    try {
        const date = new Date(isoString);
        if (isNaN(date.getTime())) return 'Invalid Date';
        const datePart = formatDate(isoString);
        let hours = date.getHours();
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const ampm = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12;
        hours = hours ? hours : 12; // the hour '0' should be '12'
        const strTime = `${String(hours).padStart(2, '0')}:${minutes} ${ampm}`;
        return `${datePart}, ${strTime}`;
    } catch (e) {
        return 'Invalid Date';
    }
};

const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR'
    }).format(amount);
};

type View = 'dashboard' | 'patients' | 'patientDetail' | 'appointments' | 'prescriptions' | 'billing';

// --- HELPER COMPONENTS ---
const PatientCard: React.FC<{ patient: Patient; onSelect: (id: string) => void }> = ({ patient, onSelect }) => (
    <div onClick={() => onSelect(patient.id)} className="bg-white p-4 rounded-lg border border-slate-200/80 shadow-sm hover:shadow-md cursor-pointer transition-shadow">
        <h3 className="text-lg font-bold text-slate-800 font-heading">{patient.name}</h3>
        <p className="text-sm text-slate-600 truncate">{patient.email}</p>
        <p className="text-sm text-slate-500">{patient.phone}</p>
    </div>
);


const App: React.FC = () => 
{
    // --- STATE MANAGEMENT ---
    const [patients, setPatients] = useState<Patient[]>(initialPatients);
    const [appointments, setAppointments] = useState<Appointment[]>(initialAppointments);
    const [prescriptions, setPrescriptions] = useState<Prescription[]>(initialPrescriptions);
    
    const [currentView, setCurrentView] = useState<View>('dashboard');
    const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [newlyCreatedPatientId, setNewlyCreatedPatientId] = useState<string | null>(null);
    const [expandedBillingRowId, setExpandedBillingRowId] = useState<string | null>(null);
    const [isMobileSidebarOpen, setMobileSidebarOpen] = useState(false);

    const [isPatientModalOpen, setPatientModalOpen] = useState(false);
    const [editingPatient, setEditingPatient] = useState<Patient | null>(null);
    const [isInlinePatientModalOpen, setInlinePatientModalOpen] = useState(false);

    const [isAppointmentModalOpen, setAppointmentModalOpen] = useState(false);
    const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null);
    const [appointmentForPatientId, setAppointmentForPatientId] = useState<string | null>(null);
    
    const [isPrescriptionModalOpen, setPrescriptionModalOpen] = useState(false);
    const [editingPrescription, setEditingPrescription] = useState<Prescription | null>(null);
    const [prescriptionForPatientId, setPrescriptionForPatientId] = useState<string | null>(null);

    const [isPrescriptionViewModalOpen, setPrescriptionViewModalOpen] = useState(false);
    const [viewingAppointment, setViewingAppointment] = useState<Appointment | null>(null);

    const [isPaymentModalOpen, setPaymentModalOpen] = useState(false);
    const [paymentForAppointment, setPaymentForAppointment] = useState<Appointment | null>(null);


    // --- HELPER FUNCTIONS ---
    const getPatientName = useCallback((patientId: string) => patients.find(p => p.id === patientId)?.name || 'Unknown Patient', [patients]);
    
    const getPaidAmount = (appointment: Appointment): number => appointment.paymentHistory?.reduce((sum, p) => sum + p.amount, 0) || 0;

    const calculatePaymentStatus = (totalFee: number, paidAmount: number): PaymentStatus => {
        if (paidAmount >= totalFee && totalFee > 0) return PaymentStatus.Paid;
        if (paidAmount > 0 && paidAmount < totalFee) return PaymentStatus.PartiallyPaid;
        return PaymentStatus.Unpaid;
    };
    
    // --- COMPUTED VALUES ---
    const handlePatientSelect = (id: string) => {
        setSelectedPatientId(id);
        setCurrentView('patientDetail');
    };

    const filteredData = useMemo(() => {
        const lowercasedSearch = searchTerm.toLowerCase();
        if (currentView === 'patients') {
            return patients.filter(p =>
                p.name.toLowerCase().includes(lowercasedSearch) ||
                p.email.toLowerCase().includes(lowercasedSearch) ||
                p.phone.includes(lowercasedSearch)
            );
        }
        if (currentView === 'billing') {
            return appointments.filter(a => {
                const patientName = getPatientName(a.patientId).toLowerCase();
                return patientName.includes(lowercasedSearch) || a.reason.toLowerCase().includes(lowercasedSearch);
            });
        }
        if (currentView === 'prescriptions') {
             return prescriptions.filter(pr => {
                const patientName = getPatientName(pr.patientId).toLowerCase();
                const medicationsText = pr.medications.map(m => m.medication).join(' ').toLowerCase();
                return patientName.includes(lowercasedSearch) || medicationsText.includes(lowercasedSearch);
            });
        }
        return [];
    }, [patients, appointments, prescriptions, searchTerm, currentView, getPatientName]);

    const selectedPatient = useMemo(() => patients.find(p => p.id === selectedPatientId), [patients, selectedPatientId]);
    const patientAppointments = useMemo(() => appointments.filter(a => a.patientId === selectedPatientId).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()), [appointments, selectedPatientId]);
    const patientPrescriptions = useMemo(() => prescriptions.filter(p => p.patientId === selectedPatientId).sort((a, b) => new Date(b.dateIssued).getTime() - new Date(a.dateIssued).getTime()), [prescriptions, selectedPatientId]);
    
    // --- CRUD & BUSINESS LOGIC ---
    const handleSavePatient = (patientData: Omit<Patient, 'id'>, isInline = false) => {
        if (editingPatient) {
            setPatients(patients.map(p => p.id === editingPatient.id ? { ...patientData, id: p.id } : p));
        } else {
            const newPatientId = `p${Date.now()}`;
            setPatients([...patients, { ...patientData, id: newPatientId }]);
            if (isInline) {
                setNewlyCreatedPatientId(newPatientId);
            }
        }
        if(isInline) {
            setInlinePatientModalOpen(false);
        } else {
            setPatientModalOpen(false);
            setEditingPatient(null);
        }
    };

    const handleDeletePatient = (id: string) => {
        if (window.confirm('Are you sure you want to delete this patient? This will also delete their appointments and prescriptions.')) {
            setPatients(patients.filter(p => p.id !== id));
            setAppointments(appointments.filter(a => a.patientId !== id));
            setPrescriptions(prescriptions.filter(pr => pr.patientId !== id));
            if (selectedPatientId === id) {
                setCurrentView('patients');
                setSelectedPatientId(null);
            }
        }
    };
    
    const handleSaveAppointment = (appointmentData: Omit<Appointment, 'id' | 'paymentStatus' | 'paymentHistory'>) => {
        if (!appointmentData.patientId) return;

        if (editingAppointment) {
            const paidAmount = getPaidAmount(editingAppointment);
            const paymentStatus = calculatePaymentStatus(appointmentData.totalFee, paidAmount);
            setAppointments(appointments.map(a => a.id === editingAppointment.id ? { ...a, ...appointmentData, paymentStatus } : a));
        } else {
            const paymentStatus = calculatePaymentStatus(appointmentData.totalFee, 0);
            const fullAppointmentData = { ...appointmentData, paymentHistory: [], paymentStatus };
            setAppointments([...appointments, { ...fullAppointmentData, id: `a${Date.now()}` }]);
        }
        setAppointmentModalOpen(false);
        setEditingAppointment(null);
        setAppointmentForPatientId(null);
    };

    const handleSavePrescription = (data: { appointmentId: string; medications: MedicationItem[] }) => {
        const { appointmentId, medications } = data;
        const appointment = appointments.find(a => a.id === appointmentId);
        if (!appointment) {
            console.error("Selected appointment not found!");
            return;
        }
        const patientId = appointment.patientId;

        const cleanedMedications = medications
            .filter(m => m.medication.trim() !== '') // Remove empty medication rows
            .map(m => ({ ...m, id: m.id || `m${Date.now()}${Math.random()}`})); // Ensure ID exists

        if (cleanedMedications.length === 0) {
            return;
        }

        const prescriptionData = { appointmentId, patientId, medications: cleanedMedications };
        
        if (editingPrescription) {
            setPrescriptions(prescriptions.map(p => p.id === editingPrescription.id ? { ...p, ...prescriptionData } : p));
        } else {
            setPrescriptions([...prescriptions, { ...prescriptionData, id: `pr${Date.now()}`, dateIssued: new Date().toISOString() }]);
        }
        setPrescriptionModalOpen(false);
        setEditingPrescription(null);
        setPrescriptionForPatientId(null);
    };

    const handleSavePayment = (data: { amount: number, method: Payment['method']}) => {
        if (!paymentForAppointment) return;

        const newPayment: Payment = {
            id: `pay${Date.now()}`,
            date: new Date().toISOString(),
            amount: data.amount,
            method: data.method,
        };

        setAppointments(prev => prev.map(appt => {
            if (appt.id === paymentForAppointment.id) {
                const updatedHistory = [...(appt.paymentHistory || []), newPayment];
                const paidAmount = updatedHistory.reduce((sum, p) => sum + p.amount, 0);
                const newStatus = calculatePaymentStatus(appt.totalFee, paidAmount);
                return {
                    ...appt,
                    paymentHistory: updatedHistory,
                    paymentStatus: newStatus,
                };
            }
            return appt;
        }));

        setPaymentModalOpen(false);
        setPaymentForAppointment(null);
    };
    
    const handleDeletePrescription = (id: string) => {
        if (window.confirm('Are you sure you want to delete this prescription?')) {
            setPrescriptions(prescriptions.filter(pr => pr.id !== id));
        }
    };

    const handlePrintPrescriptionFromList = (prescriptionId: string) => {
        const prescription = prescriptions.find(pr => pr.id === prescriptionId);
        if (!prescription) {
            console.error("Prescription not found");
            return;
        }
        const appointment = appointments.find(a => a.id === prescription.appointmentId);
        if (!appointment) {
            alert("Could not find the associated appointment for this prescription.");
            return;
        }
        setViewingAppointment(appointment);
        setPrescriptionViewModalOpen(true);
    };
    
    // --- UI COMPONENTS ---
    const Sidebar = ({ isOpen, onClose }: {isOpen: boolean, onClose: () => void}) => {
        const navItems = [
            ['dashboard', 'Dashboard', ICONS.dashboard],
            ['patients', 'Patients', ICONS.patients],
            ['appointments', 'Appointments', ICONS.appointments],
            ['prescriptions', 'Prescriptions', ICONS.prescriptions],
            ['billing', 'Billing', ICONS.billing]
        ] as const;

        const handleNavClick = (view: View) => {
          setCurrentView(view);
          onClose();
        };

        return (
          <>
            <aside className={`fixed inset-y-0 left-0 z-40 w-64 bg-slate-800 text-white flex flex-col transform transition-transform md:relative md:translate-x-0 ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                <div className="h-16 flex items-center justify-start px-4 shrink-0">
                    <svg className="h-8 w-8 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    <span className="ml-3 text-xl font-bold font-heading">ClinicFlow</span>
                </div>
                <nav className="flex-grow">
                    <ul>
                        {navItems.map(([id, text, icon]) => (
                            <li key={id}>
                                <a href="#" onClick={(e) => { e.preventDefault(); handleNavClick(id); }} className={`flex items-center py-3 px-5 transition-colors ${currentView === id ? 'bg-slate-700 text-cyan-300' : 'hover:bg-slate-700'}`}>
                                    {icon}
                                    <span className="ml-3">{text}</span>
                                </a>
                            </li>
                        ))}
                    </ul>
                </nav>
            </aside>
            {isOpen && <div onClick={onClose} className="fixed inset-0 bg-black/50 z-30 md:hidden"></div>}
          </>
        );
    };

    const Header = ({ title, onMenuClick }: { title: string, onMenuClick: () => void }) => (
        <header className="h-16 bg-white border-b border-slate-200/80 flex items-center justify-between px-4 sm:px-6 shrink-0">
            <div className="flex items-center gap-4">
                <button onClick={onMenuClick} className="text-slate-600 md:hidden">
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
                </button>
                <h1 className="text-xl sm:text-2xl font-semibold text-slate-800 font-heading">{title}</h1>
            </div>
            {(currentView === 'patients' || currentView === 'billing' || currentView === 'prescriptions') && (
                <div className="relative">
                    <input type="text" placeholder={`Search...`} className="pl-8 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 w-36 sm:w-64" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                    <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                </div>
            )}
        </header>
    );

    const DashboardView = () => {
        const totalOutstanding = appointments.reduce((acc, appt) => acc + (appt.totalFee - getPaidAmount(appt)), 0);
        return (
            <div className="p-4 sm:p-6">
                <h2 className="text-2xl font-bold mb-4 font-heading">Dashboard</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                    <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200/80"><h3 className="text-lg font-semibold text-slate-700 font-heading">Total Patients</h3><p className="text-4xl font-bold text-cyan-600">{patients.length}</p></div>
                    <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200/80"><h3 className="text-lg font-semibold text-slate-700 font-heading">Upcoming</h3><p className="text-4xl font-bold text-cyan-600">{appointments.filter(a => new Date(a.date) > new Date() && a.status === AppointmentStatus.Scheduled).length}</p></div>
                    <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200/80"><h3 className="text-lg font-semibold text-slate-700 font-heading">Today</h3><p className="text-4xl font-bold text-cyan-600">{appointments.filter(a => new Date(a.date).toDateString() === new Date().toDateString()).length}</p></div>
                    <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200/80"><h3 className="text-lg font-semibold text-slate-700 font-heading">Outstanding</h3><p className="text-3xl font-bold text-orange-600">{formatCurrency(totalOutstanding)}</p></div>
                </div>
            </div>
        )
    };

    const PatientListView = () => (
        <div className="p-4 sm:p-6">
            <button onClick={() => { setEditingPatient(null); setPatientModalOpen(true); }} className="mb-6 bg-cyan-500 text-white px-4 py-2 rounded-lg hover:bg-cyan-600 flex items-center gap-2 shadow-sm">{ICONS.add} Add Patient</button>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                {(filteredData as Patient[]).map(p => <PatientCard key={p.id} patient={p} onSelect={handlePatientSelect} />)}
            </div>
        </div>
    );
    
    const PatientDetailView = () => {
        if (!selectedPatient) return <div className="p-4 sm:p-6">Patient not found.</div>;
        return (
            <div className="p-4 sm:p-6 space-y-6">
                <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                    <div>
                        <button onClick={() => setCurrentView('patients')} className="flex items-center gap-2 text-cyan-600 hover:text-cyan-800 mb-2">{ICONS.back} Back to Patients</button>
                        <h2 className="text-2xl sm:text-3xl font-bold text-slate-800 font-heading break-words">{selectedPatient.name}</h2>
                        <p className="text-slate-500 break-words">{selectedPatient.email} | {selectedPatient.phone}</p>
                    </div>
                    <div className="flex gap-2 self-start sm:self-auto"><button onClick={() => { setEditingPatient(selectedPatient); setPatientModalOpen(true); }} className="bg-slate-200 text-slate-700 px-3 py-2 rounded-lg hover:bg-slate-300 flex items-center gap-2 text-sm">{ICONS.edit} Edit</button><button onClick={() => handleDeletePatient(selectedPatient.id)} className="bg-red-500 text-white px-3 py-2 rounded-lg hover:bg-red-600 flex items-center gap-2 text-sm">{ICONS.delete} Delete</button></div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-amber-50 border-l-4 border-amber-400 p-4 rounded">
                    <div><h4 className="font-semibold text-slate-700 font-heading">Medical History</h4><p className="text-sm break-words">{selectedPatient.medicalHistory}</p></div>
                    <div><h4 className="font-semibold text-slate-700 font-heading">Allergies</h4><p className="text-sm text-red-600 font-medium break-words">{selectedPatient.allergies}</p></div>
                </div>
                <div>
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-3 gap-2"><h3 className="text-2xl font-bold text-slate-700 font-heading">Appointments</h3><button onClick={() => { setAppointmentForPatientId(selectedPatient.id); setEditingAppointment(null); setAppointmentModalOpen(true); }} className="bg-cyan-500 text-white px-4 py-2 rounded-lg hover:bg-cyan-600 flex items-center gap-2 self-start sm:self-auto">{ICONS.add} Add</button></div>
                    <div className="bg-white rounded-lg shadow-sm border border-slate-200/80 overflow-hidden"><ul className="divide-y divide-slate-200/80">{patientAppointments.map(a => (<li key={a.id} className="p-4 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2"><div className='flex-grow'><p className="font-semibold">{a.reason}</p><p className="text-sm text-slate-500">{formatDateTime(a.date)}</p></div><div className='flex items-center gap-2 sm:gap-4 flex-wrap'><button onClick={() => {setViewingAppointment(a); setPrescriptionViewModalOpen(true)}} className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded hover:bg-slate-200">View Rx</button><span className={`px-2 py-1 text-xs font-semibold rounded-full ${PAYMENT_STATUS_COLORS[a.paymentStatus]}`}>{a.paymentStatus}</span><span className={`px-2 py-1 text-xs font-semibold rounded-full ${STATUS_COLORS[a.status]}`}>{a.status}</span> {new Date(a.date) > new Date() && (<button onClick={() => { setEditingAppointment(a); setAppointmentForPatientId(a.patientId); setAppointmentModalOpen(true); }} className="text-slate-500 hover:text-cyan-600 p-1" title="Edit Appointment">{ICONS.edit}</button>)}</div></li>))}</ul></div>
                </div>
                <div>
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-3 gap-2"><h3 className="text-2xl font-bold text-slate-700 font-heading">Prescriptions</h3><button onClick={() => { setEditingPrescription(null); setPrescriptionForPatientId(selectedPatient.id); setPrescriptionModalOpen(true); }} className="bg-cyan-500 text-white px-4 py-2 rounded-lg hover:bg-cyan-600 flex items-center gap-2 self-start sm:self-auto">{ICONS.add} Add</button></div>
                    <div className="bg-white rounded-lg shadow-sm border border-slate-200/80 overflow-hidden text-sm">
                        <div className="hidden md:grid grid-cols-[1fr,3fr,auto] gap-4 p-3 bg-slate-50 text-xs font-semibold uppercase text-slate-500"><span className="pl-2">Date Issued</span><span>Medications</span><span className="text-right pr-2">Actions</span></div>
                        <ul className="divide-y divide-slate-200/80 md:hidden">{patientPrescriptions.map(p => (
                            <li key={p.id} className="p-4 space-y-2">
                                <div className="flex justify-between items-center">
                                    <span className="font-semibold text-slate-800">{formatDate(p.dateIssued)}</span>
                                    <div className="flex justify-end gap-2 pr-2"><button onClick={() => { setEditingPrescription(p); setPrescriptionForPatientId(p.patientId); setPrescriptionModalOpen(true); }} className="text-slate-500 hover:text-cyan-600 p-1">{ICONS.edit}</button><button onClick={() => handleDeletePrescription(p.id)} className="text-slate-500 hover:text-red-600 p-1">{ICONS.delete}</button></div>
                                </div>
                                <p className="truncate text-slate-600">{p.medications[0]?.medication || 'N/A'}{p.medications.length > 1 ? ` (+${p.medications.length-1} more)`:''}</p>
                            </li>
                        ))}</ul>
                        <ul className="hidden md:block divide-y divide-slate-200/80">{patientPrescriptions.map(p => (<li key={p.id} className="grid grid-cols-[1fr,3fr,auto] gap-4 p-3 items-center hover:bg-slate-50/50">
                            <div className="pl-2"><p className="font-semibold text-slate-800">{formatDate(p.dateIssued)}</p></div>
                            <p className="truncate">{p.medications[0]?.medication || 'N/A'}{p.medications.length > 1 ? ` (+${p.medications.length-1} more)`:''}</p>
                            <div className="flex justify-end gap-2 pr-2"><button onClick={() => { setEditingPrescription(p); setPrescriptionForPatientId(p.patientId); setPrescriptionModalOpen(true); }} className="text-slate-500 hover:text-cyan-600 p-1">{ICONS.edit}</button><button onClick={() => handleDeletePrescription(p.id)} className="text-slate-500 hover:text-red-600 p-1">{ICONS.delete}</button></div>
                        </li>))}</ul>
                    </div>
                </div>
            </div>
        );
    };

    const AppointmentListView = () => (
        <div className="p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-2">
                <h2 className="text-2xl font-bold font-heading">All Appointments</h2>
                <button onClick={() => { setAppointmentForPatientId(null); setEditingAppointment(null); setAppointmentModalOpen(true); }} className="bg-cyan-500 text-white px-4 py-2 rounded-lg hover:bg-cyan-600 flex items-center gap-2 shadow-sm self-start sm:self-auto">{ICONS.add} Add Appointment</button>
            </div>
            {/* Mobile Card View */}
            <div className="md:hidden space-y-4">
                {[...appointments].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(a => (
                    <div key={a.id} className="bg-white rounded-lg shadow-sm border p-4 space-y-3">
                        <div>
                            <p className="font-bold text-slate-800">{getPatientName(a.patientId)}</p>
                            <p className="text-sm text-slate-600">{a.reason}</p>
                        </div>
                        <p className="text-sm text-slate-500">{formatDateTime(a.date)}</p>
                        <div className="flex justify-between items-center pt-2 border-t">
                            <div className="flex items-center gap-2">
                                <span className={`px-2 py-1 text-xs font-semibold rounded-full ${PAYMENT_STATUS_COLORS[a.paymentStatus]}`}>{a.paymentStatus}</span>
                                <span className={`px-2 py-1 text-xs font-semibold rounded-full ${STATUS_COLORS[a.status]}`}>{a.status}</span>
                            </div>
                            {new Date(a.date) > new Date() && (<button onClick={() => { setEditingAppointment(a); setAppointmentModalOpen(true); }} className="text-slate-500 hover:text-cyan-600 p-1" title="Edit Appointment">{ICONS.edit}</button>)}
                        </div>
                    </div>
                ))}
            </div>
            {/* Desktop Table View */}
            <div className="hidden md:block bg-white rounded-lg shadow-sm border border-slate-200/80 overflow-x-auto">
                <table className="w-full text-sm text-left text-gray-500"><thead className="text-xs text-gray-700 uppercase bg-gray-50"><tr><th scope="col" className="px-6 py-3">Patient</th><th scope="col" className="px-6 py-3">Date & Time</th><th scope="col" className="px-6 py-3">Reason</th><th scope="col" className="px-6 py-3">Payment Status</th><th scope="col" className="px-6 py-3">Status</th><th scope="col" className="px-6 py-3 text-right">Actions</th></tr></thead>
                    <tbody>{[...appointments].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(a => (<tr key={a.id} className="bg-white border-b border-slate-200/80 hover:bg-gray-50"><td className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap">{getPatientName(a.patientId)}</td><td className="px-6 py-4">{formatDateTime(a.date)}</td><td className="px-6 py-4">{a.reason}</td><td className="px-6 py-4"><span className={`px-2 py-1 text-xs font-semibold rounded-full ${PAYMENT_STATUS_COLORS[a.paymentStatus]}`}>{a.paymentStatus}</span></td><td className="px-6 py-4"><span className={`px-2 py-1 text-xs font-semibold rounded-full ${STATUS_COLORS[a.status]}`}>{a.status}</span></td><td className="px-6 py-4 text-right">{new Date(a.date) > new Date() && (<button onClick={() => { setEditingAppointment(a); setAppointmentModalOpen(true); }} className="text-slate-500 hover:text-cyan-600 p-1" title="Edit Appointment">{ICONS.edit}</button>)}</td></tr>))}</tbody>
                </table>
            </div>
        </div>
    );
    
    const PrescriptionListView = () => (
         <div className="p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-2">
                 <h2 className="text-2xl font-bold font-heading">All Prescriptions</h2>
                 <button onClick={() => { setEditingPrescription(null); setPrescriptionForPatientId(null); setPrescriptionModalOpen(true); }} className="bg-cyan-500 text-white px-4 py-2 rounded-lg hover:bg-cyan-600 flex items-center gap-2 shadow-sm self-start sm:self-auto">{ICONS.add} Add Prescription</button>
            </div>
             {/* Mobile Card View */}
            <div className="md:hidden space-y-4">
                {(filteredData as Prescription[]).sort((a,b) => new Date(b.dateIssued).getTime() - new Date(a.dateIssued).getTime()).map(p => (
                    <div key={p.id} className="bg-white rounded-lg shadow-sm border p-4 space-y-3">
                        <div>
                            <p className="font-bold text-slate-800">{getPatientName(p.patientId)}</p>
                            <p className="text-sm text-slate-500">{formatDate(p.dateIssued)}</p>
                        </div>
                        <p className="text-sm text-slate-600">{p.medications[0]?.medication || 'N/A'}{p.medications.length > 1 ? ` (+${p.medications.length-1} more)`:''}</p>
                         <div className="flex justify-end items-center pt-2 border-t">
                             <div className="flex items-center gap-2">
                                <button onClick={() => handlePrintPrescriptionFromList(p.id)} className="text-slate-500 hover:text-cyan-600 p-1" title="Print Prescription">{ICONS.print}</button>
                                <button onClick={() => { setEditingPrescription(p); setPrescriptionForPatientId(p.patientId); setPrescriptionModalOpen(true); }} className="text-slate-500 hover:text-cyan-600 p-1" title="Edit Prescription">{ICONS.edit}</button>
                                <button onClick={() => handleDeletePrescription(p.id)} className="text-slate-500 hover:text-red-600 p-1" title="Delete Prescription">{ICONS.delete}</button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
            {/* Desktop Table View */}
            <div className="hidden md:block bg-white rounded-lg shadow-sm border border-slate-200/80 overflow-x-auto">
              <table className="w-full text-sm text-left text-gray-500">
                <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3">Patient</th>
                    <th scope="col" className="px-6 py-3">Date Issued</th>
                    <th scope="col" className="px-6 py-3">Medications</th>
                    <th scope="col" className="px-6 py-3 text-right">Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {(filteredData as Prescription[])
                    .sort((a, b) => {
                      const ta = new Date(a?.dateIssued ?? 0).getTime() || 0;
                      const tb = new Date(b?.dateIssued ?? 0).getTime() || 0;
                      return tb - ta;
                    })
                    .map((p) => {
                      const medsCount = p.medications?.length ?? 0;
                      const firstMed = p.medications?.[0]?.medication ?? "N/A";
                      const moreLabel = medsCount > 1 ? ` (+${medsCount - 1} more)` : "";
                      return (
                        <tr key={p.id} className="bg-white border-b border-slate-200/80 hover:bg-gray-50">
                          <td className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap">
                            {getPatientName(p.patientId)}
                          </td>

                          <td className="px-6 py-4">
                            {formatDate(p.dateIssued)}
                          </td>

                          <td className="px-6 py-4">
                            {firstMed}{moreLabel}
                          </td>

                          <td className="px-6 py-4 text-right">
                            <div className="flex justify-end items-center gap-2">
                              <button
                                onClick={() => handlePrintPrescriptionFromList(p.id)}
                                className="text-slate-500 hover:text-cyan-600 p-1"
                                title="Print Prescription"
                              >
                                {ICONS.print}
                              </button>

                              <button
                                onClick={() => {
                                  setEditingPrescription(p);
                                  setPrescriptionForPatientId(p.patientId);
                                  setPrescriptionModalOpen(true);
                                }}
                                className="text-slate-500 hover:text-cyan-600 p-1"
                                title="Edit Prescription"
                              >
                                {ICONS.edit}
                              </button>

                              <button
                                onClick={() => handleDeletePrescription(p.id)}
                                className="text-slate-500 hover:text-red-600 p-1"
                                title="Delete Prescription"
                              >
                                {ICONS.delete}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
        </div>
    );
    
    const BillingView = () => (
         <div className="p-4 sm:p-6">
            <h2 className="text-2xl font-bold mb-4 font-heading">Billing & Payments</h2>
            {/* Mobile Card View */}
            <div className="md:hidden space-y-4">
                {(filteredData as Appointment[]).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(a => {
                    const paidAmount = getPaidAmount(a);
                    const balance = a.totalFee - paidAmount;
                    const isExpanded = expandedBillingRowId === a.id;
                    return (
                        <div key={a.id} className="bg-white rounded-lg shadow-sm border">
                            <div onClick={() => setExpandedBillingRowId(isExpanded ? null : a.id)} className="p-4 space-y-3 cursor-pointer">
                                <div>
                                    <p className="font-bold text-slate-800">{getPatientName(a.patientId)}</p>
                                    <p className="text-sm text-slate-500">{formatDate(a.date)}</p>
                                </div>
                                <div className="flex justify-between items-center text-sm">
                                    <span>Total: <span className="font-semibold">{formatCurrency(a.totalFee)}</span></span>
                                    <span>Balance: <span className={`font-semibold ${balance > 0 ? 'text-red-600' : 'text-green-600'}`}>{formatCurrency(balance)}</span></span>
                                </div>
                                <div className="flex justify-end pt-2 border-t">
                                     <span className={`px-2 py-1 text-xs font-semibold rounded-full ${PAYMENT_STATUS_COLORS[a.paymentStatus]}`}>{a.paymentStatus}</span>
                                </div>
                            </div>
                             {isExpanded && (
                                <div className="border-t bg-slate-50/70 px-4 py-4">
                                    <div className="flex justify-between items-center mb-3">
                                        <h4 className="font-semibold text-slate-700">Payment History</h4>
                                        {balance > 0 && <button onClick={() => { setPaymentForAppointment(a); setPaymentModalOpen(true); }} className="bg-green-500 text-white px-3 py-1 rounded-md hover:bg-green-600 flex items-center gap-1 text-xs">{ICONS.add} Add</button>}
                                    </div>
                                    {a.paymentHistory.length > 0 ? (
                                        <ul className="text-xs space-y-1">
                                            {a.paymentHistory.map(p => (
                                                <li key={p.id} className="flex justify-between bg-white p-2 rounded-md border">
                                                    <span>{formatDate(p.date)} ({p.method})</span>
                                                    <span className="font-medium">{formatCurrency(p.amount)}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    ) : (
                                        <p className="text-center text-xs text-slate-500 italic py-2">No payments recorded.</p>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
            {/* Desktop Table View */}
            <div className="hidden md:block bg-white rounded-lg shadow-sm border border-slate-200/80 overflow-x-auto">
                <table className="w-full text-sm text-left text-gray-500"><thead className="text-xs text-gray-700 uppercase bg-gray-50"><tr><th scope="col" className="px-6 py-3">Patient</th><th scope="col" className="px-6 py-3">Appointment Date</th><th scope="col" className="px-6 py-3">Total Fee</th><th scope="col" className="px-6 py-3">Paid Amount</th><th scope="col" className="px-6 py-3">Balance</th><th scope="col" className="px-6 py-3">Payment Status</th></tr></thead>
                    <tbody>{(filteredData as Appointment[]).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(a => {
                        const paidAmount = getPaidAmount(a);
                        const balance = a.totalFee - paidAmount;
                        const isExpanded = expandedBillingRowId === a.id;
                        return (
                        <React.Fragment key={a.id}>
                            <tr onClick={() => setExpandedBillingRowId(isExpanded ? null : a.id)} className={`bg-white hover:bg-gray-50 cursor-pointer ${isExpanded ? '' : 'border-b border-slate-200/80'}`}>
                                <td className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap">{getPatientName(a.patientId)}</td>
                                <td className="px-6 py-4">{formatDate(a.date)}</td>
                                <td className="px-6 py-4">{formatCurrency(a.totalFee)}</td>
                                <td className="px-6 py-4">{formatCurrency(paidAmount)}</td>
                                <td className={`px-6 py-4 font-medium ${balance > 0 ? 'text-red-600' : 'text-green-600'}`}>{formatCurrency(balance)}</td>
                                <td className="px-6 py-4"><span className={`px-2 py-1 text-xs font-semibold rounded-full ${PAYMENT_STATUS_COLORS[a.paymentStatus]}`}>{a.paymentStatus}</span></td>
                            </tr>
                            {isExpanded && (
                                <tr className="bg-white border-b border-slate-200/80">
                                    <td colSpan={6} className="p-0">
                                        <div className="bg-slate-50/70 px-6 py-4">
                                            <div className="flex justify-between items-center mb-3">
                                                <h4 className="font-semibold text-slate-700">Payment History</h4>
                                                {balance > 0 && <button onClick={() => { setPaymentForAppointment(a); setPaymentModalOpen(true); }} className="bg-green-500 text-white px-3 py-1 rounded-md hover:bg-green-600 flex items-center gap-1 text-xs">{ICONS.add} Add Payment</button>}
                                            </div>
                                            {a.paymentHistory.length > 0 ? (
                                                <div className="rounded-md border border-slate-200 bg-white overflow-hidden shadow-inner">
                                                    <table className="w-full text-xs text-left">
                                                        <thead className="bg-slate-100"><tr><th className="p-2 font-medium">Date</th><th className="p-2 font-medium">Amount</th><th className="p-2 font-medium">Method</th></tr></thead>
                                                        <tbody>{a.paymentHistory.map(p => (
                                                            <tr key={p.id} className="border-b border-slate-100 last:border-b-0">
                                                                <td className="p-2">{formatDate(p.date)}</td>
                                                                <td className="p-2">{formatCurrency(p.amount)}</td>
                                                                <td className="p-2">{p.method}</td>
                                                            </tr>
                                                        ))}</tbody>
                                                    </table>
                                                </div>
                                            ) : (
                                                <div className="text-center text-xs text-slate-500 italic py-4 bg-white rounded-md border border-slate-200 shadow-inner">
                                                    No payments recorded yet.
                                                </div>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </React.Fragment>);
                    })}</tbody>
                </table>
            </div>
        </div>
    );

    const FormInput = ({ label, id, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string; id: string }) => (<div><label htmlFor={id} className="block mb-2 text-sm font-medium text-gray-900">{label}</label><input id={id} className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-cyan-500 focus:border-cyan-500 block w-full p-2.5" {...props} /></div>);
    const FormTextarea = ({ label, id, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; id: string }) => (<div><label htmlFor={id} className="block mb-2 text-sm font-medium text-gray-900">{label}</label><textarea id={id} rows={3} className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-cyan-500 focus:border-cyan-500 block w-full p-2.5" {...props}></textarea></div>);
    const FormSelect = ({ label, id, children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement> & { label: string; id: string; children: React.ReactNode }) => (<div><label htmlFor={id} className="block mb-2 text-sm font-medium text-gray-900">{label}</label><select id={id} className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-cyan-500 focus:border-cyan-500 block w-full p-2.5" {...props}>{children}</select></div>);

    const PatientForm = ({ isInline = false }: { isInline?: boolean }) => {
        const [formData, setFormData] = useState({ name: editingPatient?.name || '', email: editingPatient?.email || '', phone: editingPatient?.phone || '', dob: editingPatient?.dob || '', address: editingPatient?.address || '', gender: editingPatient?.gender || 'Other', medicalHistory: editingPatient?.medicalHistory || '', allergies: editingPatient?.allergies || '' });
        const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setFormData({ ...formData, [e.target.name]: e.target.value });
        const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); handleSavePatient(formData, isInline); };
        return (<form onSubmit={handleSubmit} className="space-y-4"><FormInput label="Full Name" id="name" name="name" value={formData.name} onChange={handleChange} required /><FormInput label="Email" id="email" name="email" type="email" value={formData.email} onChange={handleChange} required /><FormInput label="Phone" id="phone" name="phone" type="tel" value={formData.phone} onChange={handleChange} required /><div className="grid grid-cols-1 sm:grid-cols-2 gap-4"><FormInput label="Date of Birth" id="dob" name="dob" type="date" value={formData.dob} onChange={handleChange} required /><FormSelect label="Gender" id="gender" name="gender" value={formData.gender} onChange={handleChange}><option>Male</option><option>Female</option><option>Other</option></FormSelect></div>{!isInline && <>
        <FormInput label="Address" id="address" name="address" value={formData.address} onChange={handleChange} required /><FormTextarea label="Medical History" id="medicalHistory" name="medicalHistory" value={formData.medicalHistory} onChange={handleChange} /><FormTextarea label="Allergies" id="allergies" name="allergies" value={formData.allergies} onChange={handleChange} /></>}<button type="submit" className="w-full text-white bg-cyan-600 hover:bg-cyan-700 focus:ring-4 focus:outline-none focus:ring-cyan-300 font-medium rounded-lg text-sm px-5 py-2.5 text-center">Save Patient</button></form>);
    };

    const AppointmentForm = () => {
        const isNewFromGlobal = !editingAppointment && !appointmentForPatientId;
        const [patientId, setPatientId] = useState(editingAppointment?.patientId || appointmentForPatientId || '');
        
        useEffect(() => {
            if (newlyCreatedPatientId) {
                setPatientId(newlyCreatedPatientId);
                setNewlyCreatedPatientId(null);
            }
        }, [newlyCreatedPatientId]);

        const [formData, setFormData] = useState({ date: editingAppointment?.date ? editingAppointment.date.slice(0, 16) : '', duration: editingAppointment?.duration || 30, reason: editingAppointment?.reason || '', notes: editingAppointment?.notes || '', status: editingAppointment?.status || AppointmentStatus.Scheduled, totalFee: editingAppointment?.totalFee || 0, vitals: { temp: editingAppointment?.vitals?.temp || '', bp: editingAppointment?.vitals?.bp || '' }, adviceGiven: editingAppointment?.adviceGiven || '', followUpDate: editingAppointment?.followUpDate ? editingAppointment.followUpDate.slice(0, 10) : '' });
        const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => { const { name, value } = e.target; if (name === 'temp' || name === 'bp') { setFormData(prev => ({ ...prev, vitals: { ...prev.vitals, [name]: value } })); } else { setFormData(prev => ({ ...prev, [name]: ['duration', 'totalFee'].includes(name) ? parseFloat(value) || 0 : value })); } };
        const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); handleSaveAppointment({ ...formData, patientId, date: new Date(formData.date).toISOString(), followUpDate: formData.followUpDate ? new Date(formData.followUpDate).toISOString() : undefined }); };
        
        return (<form onSubmit={handleSubmit} className="space-y-4">
        {isNewFromGlobal && <FormSelect label="Patient" id="patientId" name="patientId" value={patientId} onChange={(e) => { if (e.target.value === '__ADD_NEW__') { setInlinePatientModalOpen(true); } else { setPatientId(e.target.value); }}} required>{[<option key="default" value="" disabled>Select a patient</option>, ...patients.map(p => <option key={p.id} value={p.id}>{p.name}</option>), <option key="add-new" value="__ADD_NEW__" className="font-bold text-cyan-600">+ Add New Patient</option>]}</FormSelect>}
        <FormInput label="Date and Time" id="date" name="date" type="datetime-local" value={formData.date} onChange={handleChange} required />
        <FormInput label="Reason for Visit" id="reason" name="reason" value={formData.reason} onChange={handleChange} required />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4"><FormInput label="Temperature (°C)" id="temp" name="temp" value={formData.vitals.temp} onChange={handleChange} placeholder="e.g. 37.0" /><FormInput label="Blood Pressure" id="bp" name="bp" value={formData.vitals.bp} onChange={handleChange} placeholder="e.g. 120/80" /></div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4"><FormInput label="Duration (minutes)" id="duration" name="duration" type="number" value={formData.duration} onChange={handleChange} required /><FormInput label="Follow-up Date" id="followUpDate" name="followUpDate" type="date" value={formData.followUpDate} onChange={handleChange} /></div>
        <FormInput label="Total Fee (INR)" id="totalFee" name="totalFee" type="number" step="0.01" value={formData.totalFee} onChange={handleChange} required />
        <FormSelect label="Status" id="status" name="status" value={formData.status} onChange={handleChange}>{Object.values(AppointmentStatus).map(status => <option key={status} value={status}>{status}</option>)}</FormSelect>
        <FormTextarea label="Advice Given" id="adviceGiven" name="adviceGiven" value={formData.adviceGiven} onChange={handleChange} />
        <FormTextarea label="Notes" id="notes" name="notes" value={formData.notes} onChange={handleChange} />
        <button type="submit" className="w-full text-white bg-cyan-600 hover:bg-cyan-700 focus:ring-4 focus:outline-none focus:ring-cyan-300 font-medium rounded-lg text-sm px-5 py-2.5 text-center">Save Appointment</button></form>);
    };

    const PrescriptionForm = () => {
        const [patientIdForForm, setPatientIdForForm] = useState(editingPrescription?.patientId || prescriptionForPatientId || '');
        const [appointmentId, setAppointmentId] = useState(editingPrescription?.appointmentId || '');
        const [medications, setMedications] = useState<MedicationItem[]>(editingPrescription?.medications || [{ id: `m${Date.now()}`, medication: '', dosage: '', frequency: '', duration: '', instructions: '' }]);

        const appointmentsForSelectedPatient = useMemo(() => {
            if (!patientIdForForm) return [];
            return appointments.filter(a => a.patientId === patientIdForForm).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        }, [patientIdForForm, appointments]);

        useEffect(() => {
            if (editingPrescription) {
                setPatientIdForForm(editingPrescription.patientId);
                setAppointmentId(editingPrescription.appointmentId);
                setMedications(editingPrescription.medications);
            } else {
                 setMedications([{ id: `m${Date.now()}`, medication: '', dosage: '', frequency: '', duration: '', instructions: '' }])
            }
        }, [editingPrescription])

        const handleMedicationChange = (index: number, field: keyof MedicationItem, value: string) => {
            const newMedications = [...medications];
            newMedications[index] = { ...newMedications[index], [field]: value };
            setMedications(newMedications);
        };

        const addMedication = () => {
            setMedications([...medications, { id: `m${Date.now()}`, medication: '', dosage: '', frequency: '', duration: '', instructions: '' }]);
        };

        const removeMedication = (index: number) => {
            if (medications.length > 1) {
                setMedications(medications.filter((_, i) => i !== index));
            }
        };

        const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); handleSavePrescription({ appointmentId, medications }); };
    
        return (
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className='space-y-4'>
                {!editingPrescription && (
                    <>
                        <FormSelect label="Patient" id="patientIdForForm" name="patientIdForForm" value={patientIdForForm} onChange={(e) => { setPatientIdForForm(e.target.value); setAppointmentId(''); }} disabled={!!prescriptionForPatientId} required>
                            <option value="" disabled>Select a patient</option>
                            {patients.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </FormSelect>
                        <FormSelect label="Appointment" id="appointmentId" name="appointmentId" value={appointmentId} onChange={(e) => setAppointmentId(e.target.value)} disabled={!patientIdForForm} required>
                            <option value="" disabled>Select an appointment</option>
                            {appointmentsForSelectedPatient.map(a => <option key={a.id} value={a.id}>{formatDate(a.date)} - {a.reason}</option>)}
                        </FormSelect>
                    </>
                )}
                 {editingPrescription && (
                    <div className="text-sm p-3 bg-slate-100 rounded-lg">
                        <p><strong>Patient:</strong> {getPatientName(editingPrescription.patientId)}</p>
                        <p><strong>Appointment:</strong> {formatDate(appointments.find(a => a.id === editingPrescription.appointmentId)?.date)}</p>
                    </div>
                 )}
                </div>
                <div className="space-y-3 border-t pt-4 mt-4">
                    {medications.map((med, index) => (
                        <div key={med.id} className="p-4 border rounded-lg bg-slate-50 relative space-y-3">
                            {medications.length > 1 && <button type="button" onClick={() => removeMedication(index)} className="absolute top-2 right-2 text-red-500 hover:text-red-700">{ICONS.delete}</button>}
                            <FormInput label={`Medication #${index + 1}`} id={`medication-${index}`} name="medication" value={med.medication} onChange={(e) => handleMedicationChange(index, 'medication', e.target.value)} placeholder="e.g. Amoxicillin 500mg" required />
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <FormInput label="Dosage" id={`dosage-${index}`} name="dosage" value={med.dosage} onChange={(e) => handleMedicationChange(index, 'dosage', e.target.value)} placeholder="e.g. 1 tablet" required />
                                <FormInput label="Frequency" id={`frequency-${index}`} name="frequency" value={med.frequency} onChange={(e) => handleMedicationChange(index, 'frequency', e.target.value)} placeholder="e.g. Twice daily" required />
                            </div>
                            <FormInput label="Duration" id={`duration-${index}`} name="duration" value={med.duration} onChange={(e) => handleMedicationChange(index, 'duration', e.target.value)} placeholder="e.g. 7 days" required />
                            <FormInput label="Instructions" id={`instructions-${index}`} name="instructions" value={med.instructions} onChange={(e) => handleMedicationChange(index, 'instructions', e.target.value)} placeholder="e.g. Take with food" />
                        </div>
                    ))}
                </div>
                <button type="button" onClick={addMedication} className="w-full text-cyan-600 bg-cyan-50 hover:bg-cyan-100 font-medium rounded-lg text-sm px-5 py-2.5 text-center flex items-center justify-center gap-2">{ICONS.add} Add Another Medication</button>
                <button type="submit" className="w-full text-white bg-cyan-600 hover:bg-cyan-700 focus:ring-4 focus:outline-none focus:ring-cyan-300 font-medium rounded-lg text-sm px-5 py-2.5 text-center">Save Prescription</button>
            </form>
        );
    };

    const PaymentForm = () => {
        const [amount, setAmount] = useState<number>(0);
        const [method, setMethod] = useState<Payment['method']>('Cash');
        const remainingBalance = paymentForAppointment ? paymentForAppointment.totalFee - getPaidAmount(paymentForAppointment) : 0;
        
        const handleSubmit = (e: React.FormEvent) => {
            e.preventDefault();
            if(amount > 0 && amount <= remainingBalance) {
                handleSavePayment({ amount, method });
            } else {
                alert(`Payment amount must be greater than 0 and no more than the remaining balance of ${formatCurrency(remainingBalance)}.`);
            }
        };
        
        return (
            <form onSubmit={handleSubmit} className="space-y-4">
                <FormInput label={`Amount (Balance: ${formatCurrency(remainingBalance)})`} id="amount" name="amount" type="number" step="0.01" value={amount} onChange={(e) => setAmount(parseFloat(e.target.value) || 0)} max={remainingBalance} required />
                <FormSelect label="Payment Method" id="method" name="method" value={method} onChange={(e) => setMethod(e.target.value as Payment['method'])} required>
                    <option>Cash</option>
                    <option>Card</option>
                    <option>Online</option>
                    <option>Other</option>
                </FormSelect>
                <button type="submit" className="w-full text-white bg-cyan-600 hover:bg-cyan-700 focus:ring-4 focus:outline-none focus:ring-cyan-300 font-medium rounded-lg text-sm px-5 py-2.5 text-center">Record Payment</button>
            </form>
        )
    };
    
    const PrescriptionViewModal = () => {
        const patient = patients.find(p => p.id === viewingAppointment?.patientId);
        const prescription = prescriptions.find(p => p.appointmentId === viewingAppointment?.id);

        if (!viewingAppointment || !patient) return null;
        const handlePrint = () => { window.print(); };

        return (
            <Modal isOpen={isPrescriptionViewModalOpen} onClose={() => { setViewingAppointment(null); setPrescriptionViewModalOpen(false);}} title="View Prescription">
                 <style>{`
                    @media print {
                        body * { visibility: hidden; }
                        .printable-area, .printable-area * { visibility: visible; }
                        .printable-area { position: absolute; left: 0; top: 0; width: 100%; }
                        .no-print { display: none; }
                        @page { margin-top: 5cm; margin-bottom: 2cm; }
                    }
                `}</style>
                <div className="printable-area font-serif text-sm text-black">
                    <header className="flex justify-between items-start pb-2 border-b-2 border-black">
                        <div className="text-xs">
                            <h2 className="font-bold text-base">{DOCTOR_INFO.name}</h2>
                            <p>{DOCTOR_INFO.qualifications}</p>
                            <p>{DOCTOR_INFO.phone}</p>
                        </div>
                        <div className="flex flex-col items-center text-xs">
                            {CLINIC_INFO.logo}
                            <h3 className="font-bold text-base">{CLINIC_INFO.name}</h3>
                        </div>
                        <div className="text-xs text-right">
                            <p>{CLINIC_INFO.address}</p>
                            <p>{CLINIC_INFO.phone}</p>
                            <p>{CLINIC_INFO.timing}</p>
                        </div>
                    </header>
                    
                    <section className="flex justify-between items-start py-2 border-b border-black">
                        <div className="text-xs">
                            <div className="flex items-center">
                               <svg className="w-24 h-6" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 25" fill="black"><rect x="0" y="0" width="2" height="25" /><rect x="4" y="0" width="2" height="25" /><rect x="8" y="0" width="6" height="25" /><rect x="16" y="0" width="2" height="25" /><rect x="20" y="0" width="6" height="25" /><rect x="28" y="0" width="2" height="25" /><rect x="32" y="0" width="6" height="25" /><rect x="40" y="0" width="2" height="25" /><rect x="44" y="0" width="2" height="25" /><rect x="48" y="0" width="6" height="25" /><rect x="56" y="0" width="2" height="25" /><rect x="60" y="0" width="2" height="25" /><rect x="64" y="0" width="2" height="25" /><rect x="68" y="0" width="6" height="25" /><rect x="76" y="0" width="2" height="25" /><rect x="80" y="0" width="2" height="25" /><rect x="84" y="0" width="6" height="25" /><rect x="92" y="0" width="2" height="25" /><rect x="96" y="0" width="2" height="25" /></svg>
                            </div>
                            <p><span className="font-bold">ID: {patient.id.toUpperCase()} - {patient.name} ({patient.gender.charAt(0)})</span></p>
                            <p>Address: {patient.address}</p>
                            <p>Temp (deg): {viewingAppointment.vitals?.temp || 'N/A'}, BP: {viewingAppointment.vitals?.bp || 'N/A'}</p>
                        </div>
                        <div className="text-xs font-semibold">
                            <p>Date: {formatDateTime(viewingAppointment.date)}</p>
                        </div>
                    </section>

                    <section className="py-2">
                        <p className="font-bold text-lg mb-1">R</p>
                        {prescription ? (
                             <table className="w-full text-left text-xs">
                                <thead className="border-b border-black">
                                    <tr>
                                        <th className="py-1 pr-2 w-2/5">Medicine Name</th>
                                        <th className="py-1 px-2 w-2/5">Dosage</th>
                                        <th className="py-1 pl-2 w-1/5">Duration</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {prescription.medications.map((med, index) => (
                                        <tr key={med.id} className="border-b border-dashed border-gray-400">
                                            <td className="py-2 pr-2 font-semibold">{index + 1}) {med.medication}</td>
                                            <td className="py-2 px-2">{med.dosage}, {med.frequency}<br/><span className="text-gray-600">({med.instructions})</span></td>
                                            <td className="py-2 pl-2">{med.duration}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        ) : <p className="text-xs text-center italic py-4">No medications prescribed for this appointment.</p> }
                    </section>
                    
                    <section className="py-2 text-xs space-y-2">
                        <div>
                            <p className="font-bold">Advice Given:</p>
                            <p className="font-semibold">* {viewingAppointment.adviceGiven || 'N/A'}</p>
                        </div>
                        <div>
                            <p className="font-bold">Follow Up:</p>
                            <p>{formatDate(viewingAppointment.followUpDate)}</p>
                        </div>
                    </section>
                    
                    <footer className="pt-16 flex justify-end">
                        <div className="text-center text-xs">
                            <p className="italic border-b border-black pb-1 px-8">Signature</p>
                            <p className="font-bold">{DOCTOR_INFO.name}</p>
                            <p>{DOCTOR_INFO.qualifications.split('|')[0]}</p>
                        </div>
                    </footer>
                </div>
                <div className="mt-6 flex justify-end gap-3 no-print">
                    <button type="button" onClick={handlePrint} className="flex items-center gap-2 bg-cyan-600 text-white px-4 py-2 rounded-lg hover:bg-cyan-700">{ICONS.print} Print</button>
                </div>
            </Modal>
        );
    };

    const renderView = () => {
        switch (currentView) {
            case 'dashboard': return <DashboardView />;
            case 'patients': return <PatientListView />;
            case 'patientDetail': return <PatientDetailView />;
            case 'appointments': return <AppointmentListView />;
            case 'prescriptions': return <PrescriptionListView />;
            case 'billing': return <BillingView />;
            default: return <DashboardView />;
        }
    };
    
    const getHeaderTitle = () => {
        if (currentView === 'patientDetail' && selectedPatient) return `Patient Details`;
        const title = currentView.charAt(0).toUpperCase() + currentView.slice(1);
        return title;
    }

    return (
        <div className="flex h-screen bg-slate-50 text-slate-800">
            <Sidebar isOpen={isMobileSidebarOpen} onClose={() => setMobileSidebarOpen(false)} />
            <main className="flex-1 flex flex-col overflow-hidden">
                <Header title={getHeaderTitle()} onMenuClick={() => setMobileSidebarOpen(true)} />
                <div className="flex-1 overflow-y-auto">
                    {renderView()}
                </div>
            </main>
            
            <Modal isOpen={isPatientModalOpen} onClose={() => { setEditingPatient(null); setPatientModalOpen(false); }} title={editingPatient ? 'Edit Patient' : 'Add New Patient'}>
                <PatientForm />
            </Modal>
            <Modal isOpen={isInlinePatientModalOpen} onClose={() => setInlinePatientModalOpen(false)} title="Add New Patient" zIndex="z-[60]">
                <PatientForm isInline={true} />
            </Modal>
            <Modal isOpen={isAppointmentModalOpen} onClose={() => { setEditingAppointment(null); setAppointmentModalOpen(false); }} title={editingAppointment ? 'Edit Appointment' : 'Add New Appointment'}>
                <AppointmentForm />
            </Modal>
            <Modal isOpen={isPrescriptionModalOpen} onClose={() => { setEditingPrescription(null); setPrescriptionModalOpen(false); }} title={editingPrescription ? 'Edit Prescription' : 'Add New Prescription'}>
                <PrescriptionForm />
            </Modal>
            <Modal isOpen={isPaymentModalOpen} onClose={() => { setPaymentForAppointment(null); setPaymentModalOpen(false); }} title="Add Payment">
                <PaymentForm />
            </Modal>
            
            {isPrescriptionViewModalOpen && <PrescriptionViewModal />}
        </div>
    );
};

export default App;