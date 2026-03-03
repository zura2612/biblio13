/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as React from 'react';
import { useState, useEffect, ReactNode } from 'react';
import { 
  Book, 
  Users, 
  ArrowLeftRight, 
  LayoutDashboard, 
  Plus, 
  Search, 
  Trash2, 
  CheckCircle2, 
  Clock,
  BookOpen,
  ChevronRight,
  Library,
  Pencil,
  History,
  Mail,
  Phone,
  X,
  AlertTriangle,
  Download
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format, differenceInDays, isBefore } from 'date-fns';
import { fr } from 'date-fns/locale/fr';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Constants
const BOOK_CATEGORIES = [
  "inconnue",
  "roman classique",
  "roman policier",
  "roman historique",
  "bande dessinée",
  "science-fiction",
  "enfants",
  "pratique",
  "scolaire"
];

// Utility for tailwind classes
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Types
interface BookData {
  id: number;
  title: string;
  author: string;
  isbn: string;
  category: string;
  total_copies: number;
  available_copies: number;
}

interface Subscriber {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  join_date: string;
  last_payment_date: string;
}

interface Loan {
  id: number;
  book_id: number;
  subscriber_id: number;
  book_title: string;
  first_name: string;
  last_name: string;
  loan_date: string;
  due_date: string;
  return_date: string | null;
  status: 'active' | 'returned';
}

interface Stats {
  books: number;
  subscribers: number;
  activeLoans: number;
  overdueLoans: number;
  expiredMemberships: number;
}

type View = 'dashboard' | 'books' | 'subscribers' | 'loans';

export default function App() {
  const [activeView, setActiveView] = useState<View>('dashboard');
  const [stats, setStats] = useState<Stats>({ books: 0, subscribers: 0, activeLoans: 0, overdueLoans: 0, expiredMemberships: 0 });
  const [books, setBooks] = useState<BookData[]>([]);
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedSubscriber, setSelectedSubscriber] = useState<Subscriber | null>(null);
  const [selectedBook, setSelectedBook] = useState<BookData | null>(null);
  const [editingSubscriber, setEditingSubscriber] = useState<Subscriber | null>(null);
  const [editingBook, setEditingBook] = useState<BookData | null>(null);
  const [loanFilter, setLoanFilter] = useState<'all' | 'active' | 'returned' | 'overdue'>('all');
  const [bookSearch, setBookSearch] = useState('');
  const [subSearch, setSubSearch] = useState('');
  const [subFilter, setSubFilter] = useState<'all' | 'active' | 'expired'>('all');
  const [showReportIssue, setShowReportIssue] = useState(false);
  const [reportFormData, setReportFormData] = useState({ email: '', subject: '', description: '' });
  const [isReporting, setIsReporting] = useState(false);

  // Form states
  const [showAddBook, setShowAddBook] = useState(false);
  const [showAddSubscriber, setShowAddSubscriber] = useState(false);
  const [showAddLoan, setShowAddLoan] = useState(false);

  // ISBN Search state
  const [isbnSearchLoading, setIsbnSearchLoading] = useState(false);
  const [bookFormData, setBookFormData] = useState({
    title: '',
    author: '',
    isbn: '',
    category: BOOK_CATEGORIES[0],
    total_copies: '1'
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    console.log('Fetching all data...');
    setLoading(true);
    try {
      const [statsRes, booksRes, subsRes, loansRes] = await Promise.all([
        fetch('/api/stats'),
        fetch('/api/books'),
        fetch('/api/subscribers'),
        fetch('/api/loans')
      ]);
      
      console.log('Responses received:', {
        stats: statsRes.status,
        books: booksRes.status,
        subs: subsRes.status,
        loans: loansRes.status
      });

      if (statsRes.ok) {
        const data = await statsRes.json();
        console.log('Stats data:', data);
        if (data && !data.error) setStats(data);
      }
      
      if (booksRes.ok) {
        const data = await booksRes.json();
        console.log('Books data:', data);
        if (Array.isArray(data)) setBooks(data);
      }

      if (subsRes.ok) {
        const data = await subsRes.json();
        console.log('Subscribers data:', data);
        if (Array.isArray(data)) setSubscribers(data);
      }

      if (loansRes.ok) {
        const data = await loansRes.json();
        console.log('Loans data:', data);
        if (Array.isArray(data)) setLoans(data);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleIsbnSearch = async () => {
    if (!bookFormData.isbn || bookFormData.isbn.length < 10) {
      alert('Veuillez saisir un ISBN valide (10 ou 13 chiffres)');
      return;
    }

    setIsbnSearchLoading(true);
    try {
      const response = await fetch(`https://www.googleapis.com/books/v1/volumes?q=isbn:${bookFormData.isbn}`);
      const data = await response.json();

      if (data.totalItems > 0) {
        const info = data.items[0].volumeInfo;
        setBookFormData(prev => ({
          ...prev,
          title: info.title || '',
          author: info.authors ? info.authors.join(', ') : '',
          category: info.categories ? info.categories[0] : 'inconnue'
        }));
      } else {
        alert('Aucun livre trouvé pour cet ISBN');
      }
    } catch (error) {
      console.error('Error fetching from Google Books:', error);
      alert('Erreur lors de la recherche du livre');
    } finally {
      setIsbnSearchLoading(false);
    }
  };

  const handleAddBook = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    try {
      const response = await fetch('/api/books', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...bookFormData,
          total_copies: parseInt(bookFormData.total_copies)
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erreur lors de l\'ajout du livre');
      }
      
      setShowAddBook(false);
      setBookFormData({ title: '', author: '', isbn: '', category: '', total_copies: '1' });
      fetchData();
    } catch (error: any) {
      alert(error.message);
    }
  };

  const handleAddSubscriber = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData.entries());
    
    try {
      const response = await fetch('/api/subscribers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erreur lors de l\'ajout de l\'abonné');
      }
      
      setShowAddSubscriber(false);
      fetchData();
    } catch (error: any) {
      alert(error.message);
    }
  };

  const handleAddLoan = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData.entries());
    
    // Check membership status
    const subscriberId = parseInt(data.subscriber_id as string);
    const subscriber = subscribers.find(s => s.id === subscriberId);
    if (subscriber) {
      const status = getMembershipStatus(subscriber.last_payment_date);
      if (status === 'expired') {
        if (!confirm(`Attention: L'adhésion de ${subscriber.first_name} ${subscriber.last_name} a expiré. Voulez-vous quand même autoriser l'emprunt ?`)) {
          return;
        }
      }
    }

    try {
      const response = await fetch('/api/loans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          book_id: parseInt(data.book_id as string),
          subscriber_id: parseInt(data.subscriber_id as string),
          due_date: data.due_date
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erreur lors de l\'enregistrement de l\'emprunt');
      }
      
      setShowAddLoan(false);
      fetchData();
    } catch (error: any) {
      alert(error.message);
    }
  };

  const handleReturnBook = async (id: number) => {
    await fetch(`/api/loans/${id}/return`, { method: 'POST' });
    fetchData();
  };

  const handleDeleteBook = async (id: number) => {
    if (confirm('Supprimer ce livre ?')) {
      await fetch(`/api/books/${id}`, { method: 'DELETE' });
      fetchData();
    }
  };

  const handleDeleteSubscriber = async (id: number) => {
    if (confirm('Supprimer cet abonné ?')) {
      const response = await fetch(`/api/subscribers/${id}`, { method: 'DELETE' });
      if (!response.ok) {
        const data = await response.json();
        alert(data.error);
      } else {
        fetchData();
      }
    }
  };

  const handleUpdateSubscriber = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingSubscriber) return;
    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData.entries());
    
    console.log('Updating subscriber:', editingSubscriber.id, data);
    
    try {
      const url = `/api/subscribers/${editingSubscriber.id}`;
      console.log('Fetch URL:', url);
      
      const response = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erreur lors de la modification');
      }
      
      // Update local states
      const updatedSubscriber = { ...editingSubscriber, ...data } as Subscriber;
      
      setEditingSubscriber(null);
      await fetchData();
      
      // If we are currently viewing this subscriber's history, update the selectedSubscriber state
      if (selectedSubscriber && selectedSubscriber.id === editingSubscriber.id) {
        setSelectedSubscriber(updatedSubscriber);
      }
    } catch (error: any) {
      console.error('Update error:', error);
      alert(`Erreur: ${error.message}`);
    }
  };

  const handleUpdateBook = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingBook) return;
    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData.entries());
    
    try {
      const response = await fetch(`/api/books/${editingBook.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          total_copies: parseInt(data.total_copies as string)
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erreur lors de la modification');
      }
      
      setEditingBook(null);
      fetchData();
    } catch (error: any) {
      alert(error.message);
    }
  };

  const handleReportIssue = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsReporting(true);
    try {
      const response = await fetch('/api/report-issue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reportFormData)
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Erreur lors de l\'envoi');

      alert('Votre signalement a été envoyé avec succès.');
      setShowReportIssue(false);
      setReportFormData({ email: '', subject: '', description: '' });
    } catch (error: any) {
      alert(error.message);
    } finally {
      setIsReporting(false);
    }
  };

  const navigateToBookHistory = (bookId: number) => {
    const book = books.find(b => b.id === bookId);
    if (book) {
      setSelectedBook(book);
      setSelectedSubscriber(null);
      setActiveView('books');
    }
  };

  const navigateToSubscriberHistory = (subId: number) => {
    const sub = subscribers.find(s => s.id === subId);
    if (sub) {
      setSelectedSubscriber(sub);
      setSelectedBook(null);
      setActiveView('subscribers');
    }
  };

  const getMembershipStatus = (lastPaymentDate: string | null | undefined) => {
    if (!lastPaymentDate) return 'expired';
    try {
      const lastPayment = new Date(lastPaymentDate);
      if (isNaN(lastPayment.getTime())) return 'expired';
      const today = new Date();
      const diffDays = differenceInDays(today, lastPayment);
      
      if (diffDays > 365) return 'expired'; // > 365 jours expiré
      if (diffDays > 335) return 'warning'; // > 355 jours à renouveler
      return 'active'; // <= 355 jours à jour
    } catch(e) {
      return 'expired';
    } 
  };

  const safeFormat = (dateString: string | null | undefined, formatStr: string, options?: any) => {
    if (!dateString) return '-';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return '-';
      return format(date, formatStr, options);
    } catch (e) {
      return '-';
    }
  };

  const downloadCSV = (data: any[], filename: string) => {
    if (data.length === 0) return;
    
    const headers = Object.keys(data[0]);
    const csvRows = [
      headers.join(';'), // header row (using ; for French Excel compatibility)
      ...data.map(row => 
        headers.map(fieldName => {
          const value = row[fieldName];
          const escaped = ('' + (value === null || value === undefined ? '' : value)).replace(/"/g, '""');
          return `"${escaped}"`;
        }).join(';')
      )
    ];
    if ( filename === 'livres' ) csvRows[0] = 'id;titre;auteur;isbn;catégorie;qté;disponible';
    if ( filename === 'abonnes') csvRows[0] = 'id;prénom;nom;email;téléphone;création;dernier paiement';
    if ( filename === 'emprunts') csvRows[0] = 'id;num_livre;num_abonné;date emprunt;date limite;date retour;statut;titre;prénom;nom';
    
    // Add BOM for UTF-8 to handle special characters in Excel comme é par exemple
    const BOM = '\uFEFF';
    const csvString = BOM + csvRows.join('\n');
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const SidebarItem = ({ icon: Icon, label, id }: { icon: any, label: string, id: View }) => (
    <button
      onClick={() => setActiveView(id)}
      className={cn(
        "flex items-center gap-3 w-full px-4 py-3 rounded-xl transition-all duration-200",
        activeView === id 
          ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200" 
          : "text-slate-600 hover:bg-slate-100"
      )}
    >
      <Icon size={20} />
      <span className="font-medium">{label}</span>
    </button>
  );

  return (
    <div className="flex min-h-screen bg-slate-50 font-sans text-slate-900">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-slate-200 p-6 flex flex-col gap-8">
        <div className="flex items-center gap-3 px-2">
          <div className="bg-indigo-600 p-2 rounded-lg text-white">
            <Library size={24} />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-indigo-900">Association les quatre vents</h1>
        </div>

        <nav className="flex flex-col gap-2">
          <SidebarItem icon={LayoutDashboard} label="Tableau de bord" id="dashboard" />
          <SidebarItem icon={Book} label="Livres" id="books" />
          <SidebarItem icon={Users} label="Abonnés" id="subscribers" />
          <SidebarItem icon={ArrowLeftRight} label="Emprunts" id="loans" />
        </nav>

        <div className="mt-auto p-4 bg-slate-50 rounded-2xl border border-slate-100">
          <p className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-2">Statut</p>
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 text-sm text-emerald-600 font-medium">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Base de données active
            </div>
            <button 
              onClick={async () => {
                try {
                  const res = await fetch('/api/ping');
                  const data = await res.json();
                  alert(`Connexion API OK : ${data.timestamp}`);
                } catch (e) {
                  alert('Erreur de connexion à l\'API. Vérifiez votre réseau.');
                }
              }}
              className="text-[10px] text-indigo-600 hover:underline text-left"
            >
              Tester la connexion réseau
            </button>
            <button 
              onClick={() => setShowReportIssue(true)}
              className="mt-2 flex items-center gap-2 text-[10px] text-rose-600 hover:text-rose-700 font-bold uppercase tracking-wider transition-colors"
            >
              <AlertTriangle size={12} />
              Signaler un problème
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-8 overflow-y-auto">
        <header className="flex justify-between items-center mb-10">
          <div>
            <h2 className="text-3xl font-bold text-slate-900">
              {activeView === 'dashboard' ? "Tableau de bord" : 
               activeView === 'books' ? "Gestion des Livres" :
               activeView === 'subscribers' ? "Gestion des Abonnés" : "Suivi des Emprunts"}
            </h2>
            <p className="text-slate-500 mt-1">
              {activeView === 'dashboard' ? "Aperçu global de votre bibliothèque" : 
               activeView === 'books' ? "Ajoutez, modifiez ou supprimez des ouvrages" :
               activeView === 'subscribers' ? "Gérez votre base de lecteurs" : "Contrôlez les sorties et retours de livres"}
            </p>
          </div>

          <div className="flex gap-3">
            {activeView === 'books' && (
              <>
                <button 
                  onClick={() => downloadCSV(books, 'livres')}
                  className="bg-white text-slate-600 border border-slate-200 px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-slate-50 transition-colors shadow-sm"
                  title="Exporter en CSV"
                >
                  <Download size={18} /> Export CSV
                </button>
                <button 
                  onClick={() => setShowAddBook(true)}
                  className="bg-indigo-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-indigo-700 transition-colors shadow-md"
                >
                  <Plus size={18} /> Nouveau Livre
                </button>
              </>
            )}
            {activeView === 'subscribers' && (
              <>
                <button 
                  onClick={() => downloadCSV(subscribers, 'abonnes')}
                  className="bg-white text-slate-600 border border-slate-200 px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-slate-50 transition-colors shadow-sm"
                  title="Exporter en CSV"
                >
                  <Download size={18} /> Export CSV
                </button>
                <button 
                  onClick={() => setShowAddSubscriber(true)}
                  className="bg-indigo-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-indigo-700 transition-colors shadow-md"
                >
                  <Plus size={18} /> Nouvel Abonné
                </button>
              </>
            )}
            {activeView === 'loans' && (
              <>
                <button 
                  onClick={() => downloadCSV(loans, 'emprunts')}
                  className="bg-white text-slate-600 border border-slate-200 px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-slate-50 transition-colors shadow-sm"
                  title="Exporter en CSV"
                >
                  <Download size={18} /> Export CSV
                </button>
                <button 
                  onClick={() => setShowAddLoan(true)}
                  className="bg-indigo-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-indigo-700 transition-colors shadow-md"
                >
                  <Plus size={18} /> Nouvel Emprunt
                </button>
              </>
            )}
          </div>
        </header>

        <AnimatePresence mode="wait">
          {activeView === 'dashboard' && (
            <motion.div 
              key="dashboard"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
            >
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <div className="bg-indigo-50 text-indigo-600 w-12 h-12 rounded-xl flex items-center justify-center mb-4">
                  <Book size={24} />
                </div>
                <p className="text-slate-500 font-medium">Total Livres</p>
                <h3 className="text-4xl font-bold mt-1">{String(stats.books)}</h3>
              </div>
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <div className="bg-emerald-50 text-emerald-600 w-12 h-12 rounded-xl flex items-center justify-center mb-4">
                  <Users size={24} />
                </div>
                <p className="text-slate-500 font-medium">Abonnés Actifs</p>
                <h3 className="text-4xl font-bold mt-1">{String(stats.subscribers)}</h3>
              </div>
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <div className="bg-amber-50 text-amber-600 w-12 h-12 rounded-xl flex items-center justify-center mb-4">
                  <ArrowLeftRight size={24} />
                </div>
                <p className="text-slate-500 font-medium">Emprunts en cours</p>
                <h3 className="text-4xl font-bold mt-1">{String(stats.activeLoans)}</h3>
              </div>
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <div className="bg-rose-50 text-rose-600 w-12 h-12 rounded-xl flex items-center justify-center mb-4">
                  <AlertTriangle size={24} />
                </div>
                <p className="text-slate-500 font-medium">Retards</p>
                <h3 className="text-4xl font-bold mt-1 text-rose-600">{String(stats.overdueLoans)}</h3>
              </div>
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <div className="bg-rose-100 text-rose-800 w-12 h-12 rounded-xl flex items-center justify-center mb-4">
                  <Users size={24} />
                </div>
                <p className="text-slate-500 font-medium">Adhésions expirées</p>
                <h3 className="text-4xl font-bold mt-1 text-rose-800">{String(stats.expiredMemberships)}</h3>
              </div>

              <div className="md:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <h4 className="text-lg font-bold mb-4 flex items-center gap-2">
                  <Clock size={20} className="text-indigo-600" />
                  Emprunts Récents
                </h4>
                <div className="space-y-4">
                  {Array.isArray(loans) && loans.slice(0, 5).map(loan => {
                    const overdue = loan.status === 'active' && loan.due_date && isBefore(new Date(loan.due_date), new Date());
                    return (
                    <div key={loan.id} className={cn(
                      "flex items-center justify-between p-3 rounded-xl border transition-all",
                      overdue ? "bg-rose-50 border-rose-100" : "bg-slate-50 border-slate-100"
                    )}>
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "p-2 rounded-lg border",
                          overdue ? "bg-white border-rose-200" : "bg-white border-slate-200"
                        )}>
                          <BookOpen size={18} className={overdue ? "text-rose-500" : "text-slate-400"} />
                        </div>
                        <div>
                          <p 
                            className="font-semibold text-sm cursor-pointer hover:text-indigo-600 transition-colors"
                            onClick={() => navigateToBookHistory(loan.book_id)}
                          >
                            {loan.book_title}
                          </p>
                          <p 
                            className="text-xs text-slate-500 cursor-pointer hover:text-indigo-600 transition-colors"
                            onClick={() => navigateToSubscriberHistory(loan.subscriber_id)}
                          >
                            Par {loan.first_name} {loan.last_name}
                          </p>
                        </div>
                      </div>
                      <span className={cn(
                        "text-xs px-2 py-1 rounded-full font-medium",
                        overdue ? "bg-rose-100 text-rose-700" :
                        loan.status === 'active' ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"
                      )}>
                        {overdue ? 'En retard' : loan.status === 'active' ? 'En cours' : 'Retourné'}
                      </span>
                    </div>
                  );
                  })}
                  {loans.length === 0 && <p className="text-center text-slate-400 py-4">Aucun emprunt récent</p>}
                </div>
              </div>

              <div className="bg-indigo-900 text-white p-6 rounded-2xl shadow-xl relative overflow-hidden">
                <div className="relative z-10">
                  <h4 className="text-lg font-bold mb-2">Conseil du jour</h4>
                  <p className="text-indigo-200 text-sm leading-relaxed">
                    Pensez à vérifier régulièrement les dates de retour pour éviter les retards. Un système bien géré est un système efficace !
                  </p>
                  <button 
                    onClick={() => setActiveView('loans')}
                    className="mt-6 flex items-center gap-2 text-sm font-bold hover:gap-3 transition-all"
                  >
                    Voir les emprunts <ChevronRight size={16} />
                  </button>
                </div>
                <div className="absolute -right-10 -bottom-10 opacity-10">
                  <Library size={200} />
                </div>
              </div>
            </motion.div>
          )}

          {activeView === 'books' && !selectedBook && (
            <motion.div 
              key="books"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-4"
            >
              <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                  type="text" 
                  placeholder="Rechercher un livre ou un auteur..." 
                  value={bookSearch}
                  onChange={(e) => setBookSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm transition-all"
                />
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-6 py-4 text-sm font-bold text-slate-600">Titre</th>
                      <th className="px-6 py-4 text-sm font-bold text-slate-600">Auteur</th>
                      <th className="px-6 py-4 text-sm font-bold text-slate-600">Catégorie</th>
                      <th className="px-6 py-4 text-sm font-bold text-slate-600">Disponibilité</th>
                      <th className="px-6 py-4 text-sm font-bold text-slate-600 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {Array.isArray(books) && books
                      .filter(b => 
                        b.title.toLowerCase().includes(bookSearch.toLowerCase()) || 
                        b.author.toLowerCase().includes(bookSearch.toLowerCase()) ||
                        b.isbn.includes(bookSearch)
                      )
                      .map(book => (
                      <tr key={book.id} className="hover:bg-slate-50 transition-colors group">
                        <td className="px-6 py-4 cursor-pointer" onClick={() => setSelectedBook(book)}>
                          <p className="font-semibold text-slate-900 group-hover:text-indigo-600 transition-colors">{book.title}</p>
                          <p className="text-xs text-slate-400">ISBN: {book.isbn}</p>
                        </td>
                        <td className="px-6 py-4 text-slate-600">{book.author}</td>
                        <td className="px-6 py-4">
                          <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded-md text-xs font-medium">
                            {book.category}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <div className={cn(
                              "w-2 h-2 rounded-full",
                              book.available_copies > 0 ? "bg-emerald-500" : "bg-rose-500"
                            )} />
                            <span className="text-sm font-medium">
                              {book.available_copies} / {book.total_copies}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end gap-2">
                            <button 
                              onClick={() => setSelectedBook(book)}
                              className="text-slate-400 hover:text-indigo-600 transition-colors p-2"
                              title="Voir les détails"
                            >
                              <History size={18} />
                            </button>
                            <button 
                              onClick={() => setEditingBook(book)}
                              className="text-slate-400 hover:text-indigo-600 transition-colors p-2"
                              title="Modifier"
                            >
                              <Pencil size={18} />
                            </button>
                            <button 
                              onClick={() => handleDeleteBook(book.id)}
                              className="text-slate-400 hover:text-rose-600 transition-colors p-2"
                              title="Supprimer"
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {books.filter(b => 
                  b.title.toLowerCase().includes(bookSearch.toLowerCase()) || 
                  b.author.toLowerCase().includes(bookSearch.toLowerCase())
                ).length === 0 && <div className="p-10 text-center text-slate-400">Aucun livre trouvé</div>}
              </div>
            </motion.div>
          )}

          {activeView === 'books' && selectedBook && (
            <motion.div 
              key="book-details"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-6"
            >
              <button 
                onClick={() => setSelectedBook(null)}
                className="flex items-center gap-2 text-slate-500 hover:text-indigo-600 font-bold transition-colors"
              >
                <ArrowLeftRight size={18} className="rotate-180" /> Retour à la liste
              </button>

              <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-8 items-start">
                <div className="bg-indigo-600 text-white w-24 h-24 rounded-3xl flex items-center justify-center shadow-xl shadow-indigo-100">
                  <BookOpen size={40} />
                </div>
                <div className="flex-1">
                  <h3 className="text-3xl font-bold text-slate-900 mb-2">{selectedBook.title}</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-slate-600">
                    <p className="flex items-center gap-2 font-medium text-slate-900"><Pencil size={18} className="text-indigo-600" /> {selectedBook.author}</p>
                    <p className="flex items-center gap-2"><Search size={18} className="text-indigo-600" /> ISBN: {selectedBook.isbn}</p>
                    <p className="flex items-center gap-2"><Library size={18} className="text-indigo-600" /> {selectedBook.category}</p>
                    <p className="flex items-center gap-2">
                      <div className={cn(
                        "w-3 h-3 rounded-full",
                        selectedBook.available_copies > 0 ? "bg-emerald-500" : "bg-rose-500"
                      )} />
                      Stock: {selectedBook.available_copies} disponible(s) sur {selectedBook.total_copies}
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setEditingBook(selectedBook)}
                  className="bg-slate-100 text-slate-600 px-4 py-2 rounded-xl font-bold hover:bg-indigo-600 hover:text-white transition-all flex items-center gap-2"
                >
                  <Pencil size={18} /> Modifier
                </button>
              </div>

              <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                  <h4 className="font-bold text-lg flex items-center gap-2">
                    <History size={20} className="text-indigo-600" />
                    Historique des emprunts
                  </h4>
                  <span className="bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full text-xs font-bold">
                    {loans.filter(l => l.book_id === selectedBook.id).length} emprunts au total
                  </span>
                </div>
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Abonné</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Date Emprunt</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Date Retour</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Statut</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {loans.filter(l => l.book_id === selectedBook.id).map(loan => {
                      const overdue = loan.status === 'active' && loan.due_date && isBefore(new Date(loan.due_date), new Date());
                      return (
                      <tr key={loan.id} className={cn(
                        "transition-colors",
                        overdue ? "bg-rose-50 hover:bg-rose-100" : "hover:bg-slate-50"
                      )}>
                        <td className="px-6 py-4 font-semibold text-slate-900">
                          <div className="flex items-center gap-2">
                            {loan.first_name} {loan.last_name}
                            {overdue && <AlertTriangle size={14} className="text-rose-500" />}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-500">{safeFormat(loan.loan_date, 'dd/MM/yyyy')}</td>
                        <td className="px-6 py-4 text-sm text-slate-500">
                          {loan.return_date ? safeFormat(loan.return_date, 'dd/MM/yyyy') : 
                           loan.due_date ? `Échéance: ${safeFormat(loan.due_date, 'dd/MM/yyyy')}` : '-'}
                        </td>
                        <td className="px-6 py-4">
                          <span className={cn(
                            "text-xs px-2 py-1 rounded-full font-bold",
                            overdue ? "bg-rose-100 text-rose-700" :
                            loan.status === 'active' ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"
                          )}>
                            {overdue ? 'En retard' : loan.status === 'active' ? 'En cours' : 'Retourné'}
                          </span>
                        </td>
                      </tr>
                    );
                    })}
                    {loans.filter(l => l.book_id === selectedBook.id).length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-6 py-10 text-center text-slate-400">Aucun historique pour ce livre</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}

          {activeView === 'subscribers' && !selectedSubscriber && (
            <motion.div 
              key="subscribers"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-4"
            >
              <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                <div className="relative w-full max-w-md">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input 
                    type="text" 
                    placeholder="Rechercher un abonné..." 
                    value={subSearch}
                    onChange={(e) => setSubSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm transition-all"
                  />
                </div>
                <div className="flex bg-white p-1 rounded-xl border border-slate-200 w-fit shadow-sm">
                  <button 
                    onClick={() => setSubFilter('all')}
                    className={cn(
                      "px-4 py-2 rounded-lg text-sm font-bold transition-all",
                      subFilter === 'all' ? "bg-indigo-600 text-white shadow-md" : "text-slate-500 hover:bg-slate-50"
                    )}
                  >
                    Tous
                  </button>
                  <button 
                    onClick={() => setSubFilter('active')}
                    className={cn(
                      "px-4 py-2 rounded-lg text-sm font-bold transition-all",
                      subFilter === 'active' ? "bg-emerald-600 text-white shadow-md" : "text-slate-500 hover:bg-slate-50"
                    )}
                  >
                    À jour
                  </button>
                  <button 
                    onClick={() => setSubFilter('expired')}
                    className={cn(
                      "px-4 py-2 rounded-lg text-sm font-bold transition-all",
                      subFilter === 'expired' ? "bg-rose-600 text-white shadow-md" : "text-slate-500 hover:bg-slate-50"
                    )}
                  >
                    Expirés
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {Array.isArray(subscribers) && subscribers
                  .filter(s => {
                    const matchesSearch = `${s.first_name} ${s.last_name}`.toLowerCase().includes(subSearch.toLowerCase()) ||
                                         s.email.toLowerCase().includes(subSearch.toLowerCase());
                    const status = getMembershipStatus(s.last_payment_date);
                    const matchesFilter = subFilter === 'all' || 
                                         (subFilter === 'active' && status !== 'expired') ||
                                         (subFilter === 'expired' && status === 'expired');
                    return matchesSearch && matchesFilter;
                  })
                  .map(sub => {
                    const status = getMembershipStatus(sub.last_payment_date);
                    return (
                    <div key={sub.id} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow group relative overflow-hidden">
                      {status === 'expired' && <div className="absolute top-0 left-0 w-1 h-full bg-rose-500" />}
                      {status === 'warning' && <div className="absolute top-0 left-0 w-1 h-full bg-amber-500" />}
                      
                      <div className="flex items-center gap-4 mb-4">
                        <div className={cn(
                          "w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg",
                          status === 'expired' ? "bg-rose-100 text-rose-600" : "bg-indigo-100 text-indigo-600"
                        )}>
                          {sub.first_name[0]}{sub.last_name[0]}
                        </div>
                        <div className="flex-1">
                          <h4 className="font-bold text-slate-900">{sub.first_name} {sub.last_name}</h4>
                          <div className="flex items-center gap-2">
                            <span className={cn(
                              "w-2 h-2 rounded-full",
                              status === 'active' ? "bg-emerald-500" : status === 'warning' ? "bg-amber-500" : "bg-rose-500"
                            )} />
                            <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                              {status === 'active' ? 'Adhésion à jour' : status === 'warning' ? 'À renouveler' : 'Adhésion expirée'}
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => setEditingSubscriber(sub)} className="p-1.5 text-slate-400 hover:text-indigo-600 transition-colors">
                            <Pencil size={16} />
                          </button>
                          <button onClick={() => handleDeleteSubscriber(sub.id)} className="p-1.5 text-slate-400 hover:text-rose-600 transition-colors">
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                      <div className="space-y-2 text-sm text-slate-600 mb-6">
                        <p className="flex items-center gap-2"><Mail size={14} className="text-slate-400" /> {sub.email}</p>
                        <p className="flex items-center gap-2"><Phone size={14} className="text-slate-400" /> {sub.phone}</p>
                      </div>
                      <button 
                        onClick={() => setSelectedSubscriber(sub)}
                        className="w-full py-2 bg-slate-50 text-slate-600 rounded-xl text-sm font-bold hover:bg-indigo-50 hover:text-indigo-600 transition-all flex items-center justify-center gap-2"
                      >
                        <History size={16} /> Détails & Historique
                      </button>
                    </div>
                  );
                })}
              </div>
              {subscribers.filter(s => {
                const matchesSearch = `${s.first_name} ${s.last_name}`.toLowerCase().includes(subSearch.toLowerCase());
                const status = getMembershipStatus(s.last_payment_date);
                const matchesFilter = subFilter === 'all' || (subFilter === 'active' && status !== 'expired') || (subFilter === 'expired' && status === 'expired');
                return matchesSearch && matchesFilter;
              }).length === 0 && <div className="col-span-full p-10 text-center text-slate-400">Aucun abonné trouvé</div>}
            </motion.div>
          )}

          {activeView === 'subscribers' && selectedSubscriber && (
            <motion.div 
              key="subscriber-details"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-6"
            >
              <button 
                onClick={() => setSelectedSubscriber(null)}
                className="flex items-center gap-2 text-slate-500 hover:text-indigo-600 font-bold transition-colors"
              >
                <ArrowLeftRight size={18} className="rotate-180" /> Retour à la liste
              </button>

              <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-8 items-start">
                <div className="bg-indigo-600 text-white w-24 h-24 rounded-3xl flex items-center justify-center font-bold text-3xl shadow-xl shadow-indigo-100">
                  {(selectedSubscriber.first_name?.[0] || '')}{(selectedSubscriber.last_name?.[0] || '')}
                </div>
                <div className="flex-1">
                  <h3 className="text-3xl font-bold text-slate-900 mb-2">{selectedSubscriber.first_name || ''} {selectedSubscriber.last_name || ''}</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-slate-600">
                    <p className="flex items-center gap-2"><Mail size={18} className="text-indigo-600" /> {selectedSubscriber.email || '-'}</p>
                    <p className="flex items-center gap-2"><Phone size={18} className="text-indigo-600" /> {selectedSubscriber.phone || '-'}</p>
                    <p className="flex items-center gap-2"><Clock size={18} className="text-indigo-600" /> Inscrit le {safeFormat(selectedSubscriber.join_date, 'dd MMMM yyyy', { locale: fr })}</p>
                    <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-100">
                      <div className={cn(
                        "w-3 h-3 rounded-full",
                        getMembershipStatus(selectedSubscriber.last_payment_date) === 'active' ? "bg-emerald-500" :
                        getMembershipStatus(selectedSubscriber.last_payment_date) === 'warning' ? "bg-amber-500" : "bg-rose-500"
                      )} />
                      <div className="flex-1">
                        <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Statut Adhésion</p>
                        <p className="text-sm font-bold">
                          {getMembershipStatus(selectedSubscriber.last_payment_date) === 'active' ? 'À jour' :
                           getMembershipStatus(selectedSubscriber.last_payment_date) === 'warning' ? 'À renouveler bientôt' : 'Expirée'}
                          <span className="text-xs font-normal text-slate-500 ml-2">
                            (Dernier paiement: {safeFormat(selectedSubscriber.last_payment_date, 'dd/MM/yyyy')})
                          </span>
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
                <button 
                  onClick={() => setEditingSubscriber(selectedSubscriber)}
                  className="bg-slate-100 text-slate-600 px-4 py-2 rounded-xl font-bold hover:bg-indigo-600 hover:text-white transition-all flex items-center gap-2"
                >
                  <Pencil size={18} /> Modifier
                </button>
              </div>

              <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                  <h4 className="font-bold text-lg flex items-center gap-2">
                    <History size={20} className="text-indigo-600" />
                    Historique des emprunts
                  </h4>
                  <span className="bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full text-xs font-bold">
                    {loans.filter(l => l.subscriber_id === selectedSubscriber.id).length} emprunts au total
                  </span>
                </div>
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Livre</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Date Emprunt</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Date Retour</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Statut</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {loans.filter(l => l.subscriber_id === selectedSubscriber.id).map(loan => {
                      const overdue = loan.status === 'active' && loan.due_date && isBefore(new Date(loan.due_date), new Date());
                      return (
                      <tr key={loan.id} className={cn(
                        "transition-colors",
                        overdue ? "bg-rose-50 hover:bg-rose-100" : "hover:bg-slate-50"
                      )}>
                        <td className="px-6 py-4 font-semibold text-slate-900">
                          <div className="flex items-center gap-2">
                            {loan.book_title}
                            {overdue && <AlertTriangle size={14} className="text-rose-500" />}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-500">{safeFormat(loan.loan_date, 'dd/MM/yyyy')}</td>
                        <td className="px-6 py-4 text-sm text-slate-500">
                          {loan.return_date ? safeFormat(loan.return_date, 'dd/MM/yyyy') : 
                           loan.due_date ? `Échéance: ${safeFormat(loan.due_date, 'dd/MM/yyyy')}` : '-'}
                        </td>
                        <td className="px-6 py-4">
                          <span className={cn(
                            "text-xs px-2 py-1 rounded-full font-bold",
                            overdue ? "bg-rose-100 text-rose-700" :
                            loan.status === 'active' ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"
                          )}>
                            {overdue ? 'En retard' : loan.status === 'active' ? 'En cours' : 'Retourné'}
                          </span>
                        </td>
                      </tr>
                    );
                    })}
                    {loans.filter(l => l.subscriber_id === selectedSubscriber.id).length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-6 py-10 text-center text-slate-400">Aucun historique d'emprunt</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}

          {activeView === 'loans' && (
            <motion.div 
              key="loans"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-4"
            >
              <div className="flex bg-white p-1 rounded-xl border border-slate-200 w-fit shadow-sm">
                <button 
                  onClick={() => setLoanFilter('all')}
                  className={cn(
                    "px-4 py-2 rounded-lg text-sm font-bold transition-all",
                    loanFilter === 'all' ? "bg-indigo-600 text-white shadow-md" : "text-slate-500 hover:bg-slate-50"
                  )}
                >
                  Tous
                </button>
                <button 
                  onClick={() => setLoanFilter('active')}
                  className={cn(
                    "px-4 py-2 rounded-lg text-sm font-bold transition-all",
                    loanFilter === 'active' ? "bg-amber-500 text-white shadow-md" : "text-slate-500 hover:bg-slate-50"
                  )}
                >
                  En cours
                </button>
                <button 
                  onClick={() => setLoanFilter('returned')}
                  className={cn(
                    "px-4 py-2 rounded-lg text-sm font-bold transition-all",
                    loanFilter === 'returned' ? "bg-emerald-600 text-white shadow-md" : "text-slate-500 hover:bg-slate-50"
                  )}
                >
                  Retournés
                </button>
                <button 
                  onClick={() => setLoanFilter('overdue')}
                  className={cn(
                    "px-4 py-2 rounded-lg text-sm font-bold transition-all",
                    loanFilter === 'overdue' ? "bg-rose-600 text-white shadow-md" : "text-slate-500 hover:bg-slate-50"
                  )}
                >
                  En retard
                </button>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-6 py-4 text-sm font-bold text-slate-600">Livre</th>
                      <th className="px-6 py-4 text-sm font-bold text-slate-600">Abonné</th>
                      <th className="px-6 py-4 text-sm font-bold text-slate-600">Date Emprunt</th>
                      <th className="px-6 py-4 text-sm font-bold text-slate-600">Échéance</th>
                      <th className="px-6 py-4 text-sm font-bold text-slate-600">Statut</th>
                      <th className="px-6 py-4 text-sm font-bold text-slate-600 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {Array.isArray(loans) && loans
                      .filter(l => {
                        if (loanFilter === 'all') return true;
                        if (loanFilter === 'overdue') {
                          return l.status === 'active' && l.due_date && isBefore(new Date(l.due_date), new Date());
                        }
                        return l.status === loanFilter;
                      })
                      .map(loan => {
                        const overdue = loan.status === 'active' && loan.due_date && isBefore(new Date(loan.due_date), new Date());
                        const overdueDays = overdue ? differenceInDays(new Date(), new Date(loan.due_date)) : 0;

                        return (
                        <tr key={loan.id} className={cn(
                          "transition-colors",
                          overdue ? "bg-rose-50/50 hover:bg-rose-50" : "hover:bg-slate-50"
                        )}>
                          <td 
                            className="px-6 py-4 font-medium cursor-pointer hover:text-indigo-600 transition-colors"
                            onClick={() => navigateToBookHistory(loan.book_id)}
                          >
                            <div className="flex items-center gap-2">
                              {loan.book_title}
                              {overdue && <AlertTriangle size={14} className="text-rose-500" />}
                            </div>
                          </td>
                          <td 
                            className="px-6 py-4 cursor-pointer hover:text-indigo-600 transition-colors"
                            onClick={() => navigateToSubscriberHistory(loan.subscriber_id)}
                          >
                            {loan.first_name} {loan.last_name}
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-500">
                            {safeFormat(loan.loan_date, 'dd/MM/yyyy')}
                          </td>
                          <td className={cn(
                            "px-6 py-4 text-sm font-medium",
                            overdue ? "text-rose-600" : "text-slate-500"
                          )}>
                            {loan.due_date ? safeFormat(loan.due_date, 'dd/MM/yyyy') : '-'}
                            {overdue && (
                              <span className="block text-[10px] uppercase tracking-wider">
                                +{overdueDays} jours
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <span className={cn(
                              "text-xs px-2 py-1 rounded-full font-medium",
                              overdue ? "bg-rose-100 text-rose-700" :
                              loan.status === 'active' ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"
                            )}>
                              {overdue ? 'En retard' : loan.status === 'active' ? 'En cours' : 'Retourné'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            {loan.status === 'active' && (
                              <button 
                                onClick={() => handleReturnBook(loan.id)}
                                className={cn(
                                  "px-3 py-1 rounded-lg text-sm font-bold transition-colors",
                                  overdue ? "bg-rose-600 text-white hover:bg-rose-700" : "text-indigo-600 hover:bg-indigo-50"
                                )}
                              >
                                Marquer retour
                              </button>
                            )}
                            {loan.status === 'returned' && (
                              <CheckCircle2 size={18} className="text-emerald-500 ml-auto" />
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {loans.filter(l => {
                  if (loanFilter === 'all') return true;
                  if (loanFilter === 'overdue') {
                    return l.status === 'active' && l.due_date && isBefore(new Date(l.due_date), new Date());
                  }
                  return l.status === loanFilter;
                }).length === 0 && (
                  <div className="p-10 text-center text-slate-400">Aucun emprunt trouvé</div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Modals */}
      <AnimatePresence>
        {showAddBook && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl p-8 w-full max-w-md shadow-2xl"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-bold">Ajouter un livre</h3>
                <button 
                  onClick={() => {
                    setShowAddBook(false);
                    setBookFormData({ title: '', author: '', isbn: '', category: BOOK_CATEGORIES[1], total_copies: '1' });
                  }} 
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X size={24} />
                </button>
              </div>
              <form onSubmit={handleAddBook} className="space-y-4">
                <div className="flex gap-2 items-end">
                  <div className="flex-1">
                    <label className="block text-sm font-bold text-slate-700 mb-1">ISBN</label>
                    <input 
                      name="isbn" 
                      required 
                      value={bookFormData.isbn}
                      onChange={(e) => setBookFormData({...bookFormData, isbn: e.target.value})}
                      placeholder="Ex: 9782070415793"
                      className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none" 
                    />
                  </div>
                  <button 
                    type="button"
                    onClick={handleIsbnSearch}
                    disabled={isbnSearchLoading}
                    className="bg-slate-100 p-2.5 rounded-lg text-slate-600 hover:bg-slate-200 transition-colors disabled:opacity-50"
                    title="Rechercher sur Google Books"
                  >
                    {isbnSearchLoading ? <Clock size={18} className="animate-spin" /> : <Search size={18} />}
                  </button>
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Titre</label>
                  <input 
                    name="title" 
                    required 
                    value={bookFormData.title}
                    onChange={(e) => setBookFormData({...bookFormData, title: e.target.value})}
                    className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Auteur</label>
                  <input 
                    name="author" 
                    required 
                    value={bookFormData.author}
                    onChange={(e) => setBookFormData({...bookFormData, author: e.target.value})}
                    className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Catégorie</label>
                  <select 
                    name="category" 
                    required 
                    value={bookFormData.category}
                    onChange={(e) => setBookFormData({...bookFormData, category: e.target.value})}
                    className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none bg-white" 
                  >
                    {BOOK_CATEGORIES.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Nombre d'exemplaires</label>
                  <input 
                    name="total_copies" 
                    type="number" 
                    min="1" 
                    required 
                    value={bookFormData.total_copies}
                    onChange={(e) => setBookFormData({...bookFormData, total_copies: e.target.value})}
                    className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none" 
                  />
                </div>
                <div className="flex gap-3 mt-8">
                  <button 
                    type="button" 
                    onClick={() => {
                      setShowAddBook(false);
                      setBookFormData({ title: '', author: '', isbn: '', category: BOOK_CATEGORIES[1], total_copies: '1' });
                    }} 
                    className="flex-1 px-4 py-2 rounded-lg border border-slate-200 font-bold hover:bg-slate-50"
                  >
                    Annuler
                  </button>
                  <button type="submit" className="flex-1 px-4 py-2 rounded-lg bg-indigo-600 text-white font-bold hover:bg-indigo-700">Enregistrer</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {editingBook && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl p-8 w-full max-w-md shadow-2xl"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-bold">Modifier le livre</h3>
                <button onClick={() => setEditingBook(null)} className="text-slate-400 hover:text-slate-600">
                  <X size={24} />
                </button>
              </div>
              <form onSubmit={handleUpdateBook} className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Titre</label>
                  <input 
                    name="title" 
                    required 
                    defaultValue={editingBook.title}
                    className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Auteur</label>
                  <input 
                    name="author" 
                    required 
                    defaultValue={editingBook.author}
                    className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">ISBN</label>
                  <input 
                    name="isbn" 
                    required 
                    defaultValue={editingBook.isbn}
                    className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Catégorie</label>
                  <select 
                    name="category" 
                    required 
                    defaultValue={editingBook.category}
                    className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none bg-white" 
                  >
                    {BOOK_CATEGORIES.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                    {!BOOK_CATEGORIES.includes(editingBook.category) && (
                      <option value={editingBook.category}>{editingBook.category}</option>
                    )}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Nombre d'exemplaires total</label>
                  <input 
                    name="total_copies" 
                    type="number" 
                    min="1" 
                    required 
                    defaultValue={editingBook.total_copies}
                    className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none" 
                  />
                  <p className="text-[10px] text-slate-500 mt-1">Note: Le stock disponible sera ajusté automatiquement.</p>
                </div>
                <div className="flex gap-3 mt-8">
                  <button type="button" onClick={() => setEditingBook(null)} className="flex-1 px-4 py-2 rounded-lg border border-slate-200 font-bold hover:bg-slate-50">Annuler</button>
                  <button type="submit" className="flex-1 px-4 py-2 rounded-lg bg-indigo-600 text-white font-bold hover:bg-indigo-700">Mettre à jour</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {showAddSubscriber && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl p-8 w-full max-w-md shadow-2xl"
            >
              <h3 className="text-2xl font-bold mb-6">Nouvel Abonné</h3>
              <form onSubmit={handleAddSubscriber} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Prénom</label>
                    <input name="first_name" required className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Nom</label>
                    <input name="last_name" required className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Email</label>
                  <input name="email" type="email" required className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Téléphone</label>
                  <input name="phone" required className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none" />
                </div>
                <div className="flex gap-3 mt-8">
                  <button type="button" onClick={() => setShowAddSubscriber(false)} className="flex-1 px-4 py-2 rounded-lg border border-slate-200 font-bold hover:bg-slate-50">Annuler</button>
                  <button type="submit" className="flex-1 px-4 py-2 rounded-lg bg-indigo-600 text-white font-bold hover:bg-indigo-700">Enregistrer</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {showAddLoan && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl p-8 w-full max-w-md shadow-2xl"
            >
              <h3 className="text-2xl font-bold mb-6">Enregistrer un emprunt</h3>
              <form onSubmit={handleAddLoan} className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Livre</label>
                  <select name="book_id" required className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none bg-white">
                    <option value="">Sélectionner un livre</option>
                    {books.filter(b => b.available_copies > 0).map(b => (
                      <option key={b.id} value={b.id}>{b.title} ({b.available_copies} dispo)</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Abonné</label>
                  <select name="subscriber_id" required className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none bg-white">
                    <option value="">Sélectionner un abonné</option>
                    {subscribers.map(s => (
                      <option key={s.id} value={s.id}>{s.first_name} {s.last_name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Date de retour prévue</label>
                  <input name="due_date" type="date" required className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none" />
                </div>
                <div className="flex gap-3 mt-8">
                  <button type="button" onClick={() => setShowAddLoan(false)} className="flex-1 px-4 py-2 rounded-lg border border-slate-200 font-bold hover:bg-slate-50">Annuler</button>
                  <button type="submit" className="flex-1 px-4 py-2 rounded-lg bg-indigo-600 text-white font-bold hover:bg-indigo-700">Confirmer l'emprunt</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {editingSubscriber && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl p-8 w-full max-w-md shadow-2xl"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-bold">Modifier l'abonné</h3>
                <button onClick={() => setEditingSubscriber(null)} className="text-slate-400 hover:text-slate-600">
                  <X size={24} />
                </button>
              </div>
              <form onSubmit={handleUpdateSubscriber} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Prénom</label>
                    <input 
                      name="first_name" 
                      required 
                      defaultValue={editingSubscriber.first_name}
                      className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none" 
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Nom</label>
                    <input 
                      name="last_name" 
                      required 
                      defaultValue={editingSubscriber.last_name}
                      className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none" 
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Email</label>
                  <input 
                    name="email" 
                    type="email" 
                    required 
                    defaultValue={editingSubscriber.email}
                    className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Téléphone</label>
                  <input 
                    name="phone" 
                    required 
                    defaultValue={editingSubscriber.phone}
                    className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Adhésion (Dernier paiement)</label>
                  <input 
                    name="last_payment_date" 
                    type="date" 
                    required 
                    defaultValue={editingSubscriber.last_payment_date ? new Date(editingSubscriber.last_payment_date).toISOString().split('T')[0] : ''}
                    className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none" 
                  />
                </div>
                <div className="flex gap-3 mt-8">
                  <button type="button" onClick={() => setEditingSubscriber(null)} className="flex-1 px-4 py-2 rounded-lg border border-slate-200 font-bold hover:bg-slate-50">Annuler</button>
                  <button type="submit" className="flex-1 px-4 py-2 rounded-lg bg-indigo-600 text-white font-bold hover:bg-indigo-700">Mettre à jour</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
        {showReportIssue && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl p-8 w-full max-w-md shadow-2xl"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-bold flex items-center gap-2">
                  <AlertTriangle className="text-rose-600" size={24} />
                  Signaler un problème
                </h3>
                <button onClick={() => setShowReportIssue(false)} className="text-slate-400 hover:text-slate-600">
                  <X size={24} />
                </button>
              </div>
              <form onSubmit={handleReportIssue} className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Votre Email (optionnel)</label>
                  <input 
                    type="email"
                    value={reportFormData.email}
                    onChange={(e) => setReportFormData({ ...reportFormData, email: e.target.value })}
                    placeholder="votre@email.com"
                    className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Sujet</label>
                  <input 
                    required
                    value={reportFormData.subject}
                    onChange={(e) => setReportFormData({ ...reportFormData, subject: e.target.value })}
                    placeholder="Ex: Bug sur la page des livres"
                    className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Description du problème</label>
                  <textarea 
                    required
                    rows={4}
                    value={reportFormData.description}
                    onChange={(e) => setReportFormData({ ...reportFormData, description: e.target.value })}
                    placeholder="Décrivez précisément le problème rencontré..."
                    className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none resize-none" 
                  />
                </div>
                <div className="flex gap-3 mt-8">
                  <button 
                    type="button" 
                    onClick={() => setShowReportIssue(false)} 
                    className="flex-1 px-4 py-2 rounded-lg border border-slate-200 font-bold hover:bg-slate-50"
                  >
                    Annuler
                  </button>
                  <button 
                    type="submit" 
                    disabled={isReporting}
                    className="flex-1 px-4 py-2 rounded-lg bg-rose-600 text-white font-bold hover:bg-rose-700 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isReporting ? <Clock size={18} className="animate-spin" /> : "Envoyer"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
