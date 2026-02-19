import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { BackgroundDecor } from '../components/BackgroundDecor';
import { ImageUpload } from '../components/ImageUpload';
import { VideoUpload } from '../components/VideoUpload';
import { ProductTypesManagement } from '../components/ProductTypesManagement';
import { EventsManagement } from '../components/EventsManagement';
import { TicketTypesManagement } from '../components/TicketTypesManagement';
import ProfessorPayments from '../components/ProfessorPayments';
import { Database } from '../lib/database.types';
import { Video, Users, Plus, Edit2, Trash2, X, Check, AlertCircle, ShoppingBag, Package, Search, Filter, Tag, Calendar, Ticket, DollarSign } from 'lucide-react';

type Video = Database['public']['Tables']['videos']['Row'];
type Profile = Database['public']['Tables']['profiles']['Row'];
type Professor = Database['public']['Tables']['professors']['Row'] & {
  profiles: Pick<Profile, 'full_name'>;
};
type Product = Database['public']['Tables']['products']['Row'];
type ProductType = Database['public']['Tables']['product_types']['Row'];
type Order = Database['public']['Tables']['orders']['Row'] & {
  profiles?: Pick<Profile, 'full_name' | 'email'>;
};

interface VideoFormData {
  title: string;
  description: string;
  level: 'beginner' | 'intermediate' | 'advanced';
  duration_minutes: number;
  cloudflare_video_id: string;
  thumbnail_url: string;
  order_index: number;
  professor_id: string;
  is_free: boolean;
}

interface ProductFormData {
  name: string;
  description: string;
  product_type_id: string;
  price: number;
  image_url: string;
  stock_quantity: number;
  is_active: boolean;
}

interface TicketCategory {
  name: string;
  price: number;
  member_price: number;
}

interface AdminProps {
  onNavigate: (page: string) => void;
}

export function Admin({ onNavigate }: AdminProps) {
  const { user, profile } = useAuth();
  const [activeTab, setActiveTab] = useState<'videos' | 'users' | 'products' | 'product-types' | 'orders' | 'events' | 'ticket-types' | 'payments'>('videos');
  const [videos, setVideos] = useState<Video[]>([]);
  const [users, setUsers] = useState<Profile[]>([]);
  const [professors, setProfessors] = useState<Professor[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [productTypes, setProductTypes] = useState<ProductType[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [showVideoForm, setShowVideoForm] = useState(false);
  const [editingVideo, setEditingVideo] = useState<Video | null>(null);
  const [showUserForm, setShowUserForm] = useState(false);
  const [editingUser, setEditingUser] = useState<Profile | null>(null);
  const [showProductForm, setShowProductForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [videoForm, setVideoForm] = useState<VideoFormData>({
    title: '',
    description: '',
    level: 'beginner',
    duration_minutes: 0,
    cloudflare_video_id: '',
    thumbnail_url: '',
    order_index: 0,
    professor_id: '',
    is_free: false,
  });

  const [userForm, setUserForm] = useState({
    email: '',
    password: '',
    full_name: '',
    role: 'student' as 'student' | 'professor' | 'admin',
  });

  const [productForm, setProductForm] = useState<ProductFormData>({
    name: '',
    description: '',
    product_type_id: '',
    price: 0,
    image_url: '',
    stock_quantity: 0,
    is_active: true,
  });


  const [ticketCategories, setTicketCategories] = useState<TicketCategory[]>([]);
  const [newTicketCategory, setNewTicketCategory] = useState<TicketCategory>({
    name: '',
    price: 0,
    member_price: 0,
  });

  const [productSearch, setProductSearch] = useState('');
  const [productCategoryFilter, setProductCategoryFilter] = useState<'all' | 'merchandise' | 'event_pass'>('all');
  const [productStatusFilter, setProductStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [productStockFilter, setProductStockFilter] = useState<'all' | 'in_stock' | 'out_of_stock'>('all');

  useEffect(() => {
    if (profile?.role !== 'admin') {
      onNavigate('academy');
      return;
    }
    loadData();
  }, [profile, onNavigate]);

  const loadData = async () => {
    setLoading(true);
    await Promise.all([loadVideos(), loadUsers(), loadProfessors(), loadProducts(), loadProductTypes(), loadOrders()]);
    setLoading(false);
  };

  const loadVideos = async () => {
    const { data, error } = await supabase
      .from('videos')
      .select('*')
      .order('level')
      .order('order_index');

    if (!error && data) {
      setVideos(data);
    }
  };

  const loadUsers = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setUsers(data);
    }
  };

  const loadProfessors = async () => {
    const { data, error } = await supabase
      .from('professors')
      .select('*, profiles(full_name)');

    if (!error && data) {
      setProfessors(data as Professor[]);
    }
  };

  const loadProducts = async () => {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setProducts(data);
    }
  };

  const loadProductTypes = async () => {
    const { data, error } = await supabase
      .from('product_types')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setProductTypes(data);
    }
  };

  const loadOrders = async () => {
    const { data, error } = await supabase
      .from('orders')
      .select('*, profiles(full_name, email)')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setOrders(data as Order[]);
    }
  };

  const handleVideoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      if (editingVideo) {
        const { error } = await supabase
          .from('videos')
          .update({ ...videoForm, updated_at: new Date().toISOString() })
          .eq('id', editingVideo.id);

        if (error) throw error;
        setSuccess('Video updated successfully');
      } else {
        const { error } = await supabase
          .from('videos')
          .insert([videoForm]);

        if (error) throw error;
        setSuccess('Video added successfully');
      }

      await loadVideos();
      resetVideoForm();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDeleteVideo = async (id: string) => {
    if (!confirm('Are you sure you want to delete this video?')) return;

    const { error } = await supabase
      .from('videos')
      .delete()
      .eq('id', id);

    if (!error) {
      await loadVideos();
      setSuccess('Video deleted successfully');
      setTimeout(() => setSuccess(''), 3000);
    } else {
      setError(error.message);
    }
  };

  const handleEditVideo = (video: Video) => {
    setEditingVideo(video);
    setVideoForm({
      title: video.title,
      description: video.description,
      level: video.level,
      duration_minutes: video.duration_minutes,
      cloudflare_video_id: video.cloudflare_video_id || '',
      thumbnail_url: video.thumbnail_url,
      order_index: video.order_index,
      professor_id: video.professor_id || '',
      is_free: video.is_free,
    });
    setShowVideoForm(true);
  };

  const resetVideoForm = () => {
    setVideoForm({
      title: '',
      description: '',
      level: 'beginner',
      duration_minutes: 0,
      cloudflare_video_id: '',
      thumbnail_url: '',
      order_index: 0,
      professor_id: '',
      is_free: false,
    });
    setEditingVideo(null);
    setShowVideoForm(false);
  };

  const handleUpdateUserAccess = async (userId: string, status: 'active' | 'inactive', expiresAt?: string) => {
    const { error } = await supabase
      .from('profiles')
      .update({
        platform_subscription_status: status,
        platform_subscription_expires_at: expiresAt || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);

    if (!error) {
      await loadUsers();
      setSuccess('User access updated');
      setTimeout(() => setSuccess(''), 3000);
    } else {
      setError(error.message);
    }
  };

  const handleUpdateUserRole = async (userId: string, role: 'student' | 'professor' | 'admin') => {
    const { error } = await supabase
      .from('profiles')
      .update({ role, updated_at: new Date().toISOString() })
      .eq('id', userId);

    if (!error) {
      await loadUsers();
      setSuccess('User role updated');
      setTimeout(() => setSuccess(''), 3000);
    } else {
      setError(error.message);
    }
  };

  const handleToggleFounderStatus = async (userId: string, currentStatus: boolean) => {
    const { error } = await supabase
      .from('professors')
      .upsert({
        id: userId,
        is_founder: !currentStatus,
      }, {
        onConflict: 'id',
        ignoreDuplicates: false
      });

    if (error) {
      setError(error.message);
      return;
    }

    await loadProfessors();
    setSuccess('Founder status updated');
    setTimeout(() => setSuccess(''), 3000);
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (!token) {
        throw new Error('No authentication token');
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-users`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(userForm),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to create user');
      }

      setSuccess('User created successfully');
      await loadUsers();
      resetUserForm();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    setError('');
    setSuccess('');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (!token) {
        throw new Error('No authentication token');
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-users/${editingUser.id}`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: userForm.email,
            full_name: userForm.full_name,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to update user');
      }

      setSuccess('User updated successfully');
      await loadUsers();
      resetUserForm();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) return;

    setError('');
    setSuccess('');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (!token) {
        throw new Error('No authentication token');
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-users/${userId}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to delete user');
      }

      setSuccess('User deleted successfully');
      await loadUsers();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleEditUser = (user: Profile) => {
    setEditingUser(user);
    setUserForm({
      email: user.email,
      password: '',
      full_name: user.full_name || '',
      role: user.role,
    });
    setShowUserForm(true);
  };

  const resetUserForm = () => {
    setUserForm({
      email: '',
      password: '',
      full_name: '',
      role: 'student',
    });
    setEditingUser(null);
    setShowUserForm(false);
  };

  const handleProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      const productData = { ...productForm, updated_at: new Date().toISOString() };

      if (productForm.category === 'event_pass' && ticketCategories.length > 0) {
        productData.price = 0;
        productData.member_price = 0;
        (productData as any).details = {
          ...((editingProduct?.details as any) || {}),
          ticket_categories: ticketCategories
        };
      }

      if (editingProduct) {
        const { error } = await supabase
          .from('products')
          .update(productData)
          .eq('id', editingProduct.id);

        if (error) throw error;
        setSuccess('Product updated successfully');
      } else {
        const { error } = await supabase
          .from('products')
          .insert([productData]);

        if (error) throw error;
        setSuccess('Product added successfully');
      }

      await loadProducts();
      resetProductForm();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDeleteProduct = async (id: string) => {
    if (!confirm('Are you sure you want to delete this product?')) return;

    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', id);

    if (!error) {
      await loadProducts();
      setSuccess('Product deleted successfully');
      setTimeout(() => setSuccess(''), 3000);
    } else {
      setError(error.message);
    }
  };

  const handleEditProduct = (product: Product) => {
    setEditingProduct(product);
    setProductForm({
      name: product.name,
      description: product.description,
      category: product.category,
      type: product.type,
      product_type_id: product.product_type_id || '',
      product_size_id: product.product_size_id || '',
      price: product.price,
      member_price: product.member_price,
      image_url: product.image_url,
      stock: product.stock,
      is_active: product.is_active,
      order_index: product.order_index,
    });

    if (product.category === 'event_pass' && product.details && (product.details as any).ticket_categories) {
      setTicketCategories((product.details as any).ticket_categories || []);
    } else {
      setTicketCategories([]);
    }

    setShowProductForm(true);
  };

  const resetProductForm = () => {
    setProductForm({
      name: '',
      description: '',
      category: 'merchandise',
      type: '',
      product_type_id: '',
      product_size_id: '',
      price: 0,
      member_price: 0,
      image_url: '',
      stock: 0,
      is_active: true,
      order_index: 0,
    });
    setTicketCategories([]);
    setNewTicketCategory({ name: '', price: 0, member_price: 0 });
    setEditingProduct(null);
    setShowProductForm(false);
  };

  const handleAddTicketCategory = () => {
    if (!newTicketCategory.name || newTicketCategory.price <= 0) {
      setError('Please provide a category name and price');
      setTimeout(() => setError(''), 3000);
      return;
    }

    setTicketCategories([...ticketCategories, newTicketCategory]);
    setNewTicketCategory({ name: '', price: 0, member_price: 0 });
  };

  const handleRemoveTicketCategory = (index: number) => {
    setTicketCategories(ticketCategories.filter((_, i) => i !== index));
  };

  if (profile?.role !== 'admin') {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-gray-950 pt-20 pb-12 relative overflow-hidden">
      <BackgroundDecor />
      <div className="absolute top-40 right-0 w-72 h-72 bg-[#B8913D] opacity-5 rounded-full blur-3xl"></div>
      <div className="absolute bottom-40 left-0 w-72 h-72 bg-[#A07F35] opacity-5 rounded-full blur-3xl"></div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="mb-8 text-center">
          <h1 className="text-3xl sm:text-4xl font-light text-white mb-2">
            Admin <span className="text-[#B8913D]">Dashboard</span>
          </h1>
          <div className="flex justify-center mb-3">
            <div className="w-16 h-1 bg-gradient-to-r from-transparent via-[#B8913D] to-transparent rounded-full"></div>
          </div>
          <p className="text-gray-400">Manage videos and users</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-xl flex items-start space-x-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {success && (
          <div className="mb-6 p-4 bg-green-50 border border-green-100 rounded-xl flex items-start space-x-3">
            <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-green-800">{success}</p>
          </div>
        )}

        <div className="flex justify-center mb-8 overflow-x-auto">
          <div className="inline-flex space-x-3 p-2 bg-gray-800/50 border border-gray-700/50 rounded-full shadow-md">
            <button
              onClick={() => setActiveTab('videos')}
              className={`px-6 py-3 rounded-full font-medium transition-all flex items-center space-x-2 whitespace-nowrap ${
                activeTab === 'videos'
                  ? 'bg-gradient-to-r from-[#B8913D] to-[#D4AC5B] text-white border-transparent'
                  : 'text-gray-300 hover:bg-gray-700/70'
              }`}
            >
              <Video className="w-4 h-4" />
              <span>Videos</span>
            </button>
            <button
              onClick={() => setActiveTab('users')}
              className={`px-6 py-3 rounded-full font-medium transition-all flex items-center space-x-2 whitespace-nowrap ${
                activeTab === 'users'
                  ? 'bg-gradient-to-r from-[#B8913D] to-[#D4AC5B] text-white border-transparent'
                  : 'text-gray-300 hover:bg-gray-700/70'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Users</span>
            </button>
            <button
              onClick={() => setActiveTab('products')}
              className={`px-6 py-3 rounded-full font-medium transition-all flex items-center space-x-2 whitespace-nowrap ${
                activeTab === 'products'
                  ? 'bg-gradient-to-r from-[#B8913D] to-[#D4AC5B] text-white border-transparent'
                  : 'text-gray-300 hover:bg-gray-700/70'
              }`}
            >
              <ShoppingBag className="w-4 h-4" />
              <span>Products</span>
            </button>
            <button
              onClick={() => setActiveTab('product-types')}
              className={`px-6 py-3 rounded-full font-medium transition-all flex items-center space-x-2 whitespace-nowrap ${
                activeTab === 'product-types'
                  ? 'bg-gradient-to-r from-[#B8913D] to-[#D4AC5B] text-white border-transparent'
                  : 'text-gray-300 hover:bg-gray-700/70'
              }`}
            >
              <Tag className="w-4 h-4" />
              <span>Product Types</span>
            </button>
            <button
              onClick={() => setActiveTab('orders')}
              className={`px-6 py-3 rounded-full font-medium transition-all flex items-center space-x-2 whitespace-nowrap ${
                activeTab === 'orders'
                  ? 'bg-gradient-to-r from-[#B8913D] to-[#D4AC5B] text-white border-transparent'
                  : 'text-gray-300 hover:bg-gray-700/70'
              }`}
            >
              <Package className="w-4 h-4" />
              <span>Orders</span>
            </button>
            <button
              onClick={() => setActiveTab('events')}
              className={`px-6 py-3 rounded-full font-medium transition-all flex items-center space-x-2 whitespace-nowrap ${
                activeTab === 'events'
                  ? 'bg-gradient-to-r from-[#B8913D] to-[#D4AC5B] text-white border-transparent'
                  : 'text-gray-300 hover:bg-gray-700/70'
              }`}
            >
              <Calendar className="w-4 h-4" />
              <span>Events</span>
            </button>
            <button
              onClick={() => setActiveTab('ticket-types')}
              className={`px-6 py-3 rounded-full font-medium transition-all flex items-center space-x-2 whitespace-nowrap ${
                activeTab === 'ticket-types'
                  ? 'bg-gradient-to-r from-[#B8913D] to-[#D4AC5B] text-white border-transparent'
                  : 'text-gray-300 hover:bg-gray-700/70'
              }`}
            >
              <Ticket className="w-4 h-4" />
              <span>Ticket Types</span>
            </button>
            <button
              onClick={() => setActiveTab('payments')}
              className={`px-6 py-3 rounded-full font-medium transition-all flex items-center space-x-2 whitespace-nowrap ${
                activeTab === 'payments'
                  ? 'bg-gradient-to-r from-[#B8913D] to-[#D4AC5B] text-white border-transparent'
                  : 'text-gray-300 hover:bg-gray-700/70'
              }`}
            >
              <DollarSign className="w-4 h-4" />
              <span>Payments</span>
            </button>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block w-8 h-8 border-4 border-[#B8913D] border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : activeTab === 'videos' ? (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-light text-white">Video Management</h2>
              <button
                onClick={() => setShowVideoForm(!showVideoForm)}
                className="flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-[#B8913D] to-[#A07F35] text-white rounded-full hover:shadow-xl transition-all hover:scale-105"
              >
                {showVideoForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                <span>{showVideoForm ? 'Cancel' : 'Add Video'}</span>
              </button>
            </div>

            {showVideoForm && (
              <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl p-8 border border-gray-700/50">
                <h3 className="text-xl font-medium text-white mb-6">
                  {editingVideo ? 'Edit Video' : 'Add New Video'}
                </h3>
                <form onSubmit={handleVideoSubmit} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Title *
                      </label>
                      <input
                        type="text"
                        value={videoForm.title}
                        onChange={(e) => setVideoForm({ ...videoForm, title: e.target.value })}
                        required
                        className="w-full px-4 py-3 bg-gray-900/50 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-[#B8913D] focus:border-transparent outline-none transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Level *
                      </label>
                      <select
                        value={videoForm.level}
                        onChange={(e) => setVideoForm({ ...videoForm, level: e.target.value as any })}
                        className="w-full px-4 py-3 bg-gray-900/50 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-[#B8913D] focus:border-transparent outline-none transition-all"
                      >
                        <option value="beginner">Beginner</option>
                        <option value="intermediate">Intermediate</option>
                        <option value="advanced">Advanced</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Duration (minutes) *
                      </label>
                      <input
                        type="number"
                        value={videoForm.duration_minutes}
                        onChange={(e) => setVideoForm({ ...videoForm, duration_minutes: parseInt(e.target.value) || 0 })}
                        required
                        className="w-full px-4 py-3 bg-gray-900/50 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-[#B8913D] focus:border-transparent outline-none transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Order Index
                      </label>
                      <input
                        type="number"
                        value={videoForm.order_index}
                        onChange={(e) => setVideoForm({ ...videoForm, order_index: parseInt(e.target.value) || 0 })}
                        className="w-full px-4 py-3 bg-gray-900/50 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-[#B8913D] focus:border-transparent outline-none transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Professor
                      </label>
                      <select
                        value={videoForm.professor_id}
                        onChange={(e) => setVideoForm({ ...videoForm, professor_id: e.target.value })}
                        className="w-full px-4 py-3 bg-gray-900/50 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-[#B8913D] focus:border-transparent outline-none transition-all"
                      >
                        <option value="">Select a professor</option>
                        {professors.map((prof) => (
                          <option key={prof.id} value={prof.id}>
                            {prof.profiles.full_name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="is_free"
                        checked={videoForm.is_free}
                        onChange={(e) => setVideoForm({ ...videoForm, is_free: e.target.checked })}
                        className="w-4 h-4 text-[#B8913D] border-gray-300 rounded focus:ring-[#B8913D]"
                      />
                      <label htmlFor="is_free" className="text-sm font-medium text-gray-300">
                        Free Preview
                      </label>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Description
                    </label>
                    <textarea
                      value={videoForm.description}
                      onChange={(e) => setVideoForm({ ...videoForm, description: e.target.value })}
                      rows={3}
                      className="w-full px-4 py-3 bg-gray-900/50 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-[#B8913D] focus:border-transparent outline-none transition-all"
                    />
                  </div>

                  <div>
                    <VideoUpload
                      currentVideoId={videoForm.cloudflare_video_id}
                      onVideoIdChange={(videoId) => setVideoForm({ ...videoForm, cloudflare_video_id: videoId })}
                      videoTitle={videoForm.title}
                      label="Video *"
                    />
                  </div>

                  <ImageUpload
                    currentImageUrl={videoForm.thumbnail_url}
                    onImageUrlChange={(url) => setVideoForm({ ...videoForm, thumbnail_url: url })}
                    label="Video Thumbnail"
                    aspectRatio="video"
                  />

                  <div className="flex justify-end space-x-3">
                    <button
                      type="button"
                      onClick={resetVideoForm}
                      className="px-6 py-3 border border-gray-600 text-gray-300 rounded-lg hover:bg-gray-700/50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-6 py-3 bg-gradient-to-r from-[#B8913D] to-[#A07F35] text-white rounded-lg hover:shadow-lg transition-all"
                    >
                      {editingVideo ? 'Update Video' : 'Add Video'}
                    </button>
                  </div>
                </form>
              </div>
            )}

            <div className="grid grid-cols-1 gap-4">
              {videos.map((video) => (
                <div
                  key={video.id}
                  className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-6 border border-gray-700/50 group"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <h3 className="text-lg font-medium text-white">{video.title}</h3>
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                          video.level === 'beginner' ? 'bg-green-500/20 text-green-300 border border-green-500/30' :
                          video.level === 'intermediate' ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' :
                          'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        }`}>
                          {video.level}
                        </span>
                        {video.is_free && (
                          <span className="px-3 py-1 bg-[#B8913D] bg-opacity-10 text-[#B8913D] rounded-full text-xs font-medium border border-[#B8913D]/30">
                            Free
                          </span>
                        )}
                      </div>
                      <p className="text-gray-300 text-sm mb-2">{video.description}</p>
                      <div className="flex items-center space-x-4 text-sm text-gray-400">
                        <span>{video.duration_minutes} min</span>
                        <span>•</span>
                        <span>Order: {video.order_index}</span>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2 ml-4 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleEditVideo(video)}
                        className="p-2 text-[#B8913D] hover:bg-[#B8913D] hover:bg-opacity-10 rounded-lg transition-colors"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteVideo(video.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : activeTab === 'users' ? (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-light text-white">User Management</h2>
              <button
                onClick={() => setShowUserForm(!showUserForm)}
                className="flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-[#B8913D] to-[#A07F35] text-white rounded-full hover:shadow-xl transition-all hover:scale-105"
              >
                {showUserForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                <span>{showUserForm ? 'Cancel' : 'Add User'}</span>
              </button>
            </div>

            {showUserForm && (
              <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl p-8 border border-gray-700/50">
                <h3 className="text-xl font-medium text-white mb-6">
                  {editingUser ? 'Edit User' : 'Create New User'}
                </h3>
                <form onSubmit={editingUser ? handleUpdateUser : handleCreateUser} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Email *
                      </label>
                      <input
                        type="email"
                        value={userForm.email}
                        onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                        required
                        className="w-full px-4 py-3 bg-gray-900/50 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-[#B8913D] focus:border-transparent outline-none transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Full Name *
                      </label>
                      <input
                        type="text"
                        value={userForm.full_name}
                        onChange={(e) => setUserForm({ ...userForm, full_name: e.target.value })}
                        required
                        className="w-full px-4 py-3 bg-gray-900/50 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-[#B8913D] focus:border-transparent outline-none transition-all"
                      />
                    </div>

                    {!editingUser && (
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Password *
                        </label>
                        <input
                          type="password"
                          value={userForm.password}
                          onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                          required={!editingUser}
                          minLength={6}
                          className="w-full px-4 py-3 bg-gray-900/50 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-[#B8913D] focus:border-transparent outline-none transition-all"
                        />
                      </div>
                    )}

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Role *
                      </label>
                      <select
                        value={userForm.role}
                        onChange={(e) => setUserForm({ ...userForm, role: e.target.value as any })}
                        className="w-full px-4 py-3 bg-gray-900/50 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-[#B8913D] focus:border-transparent outline-none transition-all"
                      >
                        <option value="student">Student</option>
                        <option value="professor">Professor</option>
                        <option value="admin">Admin</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex justify-end space-x-3">
                    <button
                      type="button"
                      onClick={resetUserForm}
                      className="px-6 py-3 border border-gray-600 text-gray-300 rounded-lg hover:bg-gray-700/50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-6 py-3 bg-gradient-to-r from-[#B8913D] to-[#A07F35] text-white rounded-lg hover:shadow-lg transition-all"
                    >
                      {editingUser ? 'Update User' : 'Create User'}
                    </button>
                  </div>
                </form>
              </div>
            )}

            <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl border border-gray-700/50 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-800/80 border-b border-gray-700/50">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-200 uppercase tracking-wider">
                        User
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-200 uppercase tracking-wider">
                        Role
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-200 uppercase tracking-wider">
                        Fondateur
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-200 uppercase tracking-wider">
                        Subscription
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-200 uppercase tracking-wider">
                        Expires
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-200 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-700/50">
                    {users.map((user) => (
                      <tr key={user.id} className="bg-gray-800/40 hover:bg-gray-700/50 transition-colors">
                        <td className="px-6 py-4">
                          <div>
                            <div className="font-medium text-white">{user.full_name || 'No name'}</div>
                            <div className="text-sm text-gray-400">{user.email}</div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <select
                            value={user.role}
                            onChange={(e) => handleUpdateUserRole(user.id, e.target.value as any)}
                            className="px-3 py-2 bg-gray-900/50 border border-gray-600 text-white rounded-lg text-sm focus:ring-2 focus:ring-[#B8913D] focus:border-transparent outline-none"
                          >
                            <option value="student">Student</option>
                            <option value="professor">Professor</option>
                            <option value="admin">Admin</option>
                          </select>
                        </td>
                        <td className="px-6 py-4">
                          {user.role === 'professor' && (
                            <button
                              onClick={() => {
                                const professor = professors.find(p => p.id === user.id);
                                handleToggleFounderStatus(user.id, professor?.is_founder || false);
                              }}
                              className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                                professors.find(p => p.id === user.id)?.is_founder
                                  ? 'bg-[#B8913D]/20 text-[#B8913D] border-[#B8913D]/30 hover:bg-[#B8913D]/30'
                                  : 'bg-gray-500/20 text-gray-400 border-gray-500/30 hover:bg-gray-500/30'
                              }`}
                            >
                              {professors.find(p => p.id === user.id)?.is_founder ? 'Fondateur' : 'Non'}
                            </button>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-3 py-1 rounded-full text-xs font-medium border ${
                            user.platform_subscription_status === 'active' ? 'bg-green-500/20 text-green-300 border-green-500/30' :
                            user.platform_subscription_status === 'trial' ? 'bg-blue-500/20 text-blue-300 border-blue-500/30' :
                            'bg-gray-500/20 text-gray-400 border-gray-500/30'
                          }`}>
                            {user.platform_subscription_status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-400">
                          {user.platform_subscription_expires_at
                            ? new Date(user.platform_subscription_expires_at).toLocaleDateString()
                            : '-'}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => {
                                const expiry = new Date();
                                expiry.setMonth(expiry.getMonth() + 1);
                                handleUpdateUserAccess(user.id, 'active', expiry.toISOString());
                              }}
                              className="px-3 py-1 text-xs bg-[#B8913D] bg-opacity-10 text-[#B8913D] rounded-lg hover:bg-opacity-20 transition-colors"
                            >
                              Grant
                            </button>
                            <button
                              onClick={() => handleUpdateUserAccess(user.id, 'inactive')}
                              className="px-3 py-1 text-xs bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 transition-colors"
                            >
                              Revoke
                            </button>
                            <button
                              onClick={() => handleEditUser(user)}
                              className="p-2 text-[#B8913D] hover:bg-[#B8913D] hover:bg-opacity-10 rounded-lg transition-colors"
                              title="Edit user"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteUser(user.id)}
                              className="p-2 text-red-400 hover:bg-red-400 hover:bg-opacity-10 rounded-lg transition-colors"
                              title="Delete user"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : activeTab === 'products' ? (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-light text-white">Product Management</h2>
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => onNavigate('shop')}
                  className="px-6 py-3 border border-[#B8913D] text-[#B8913D] rounded-full hover:bg-[#B8913D] hover:text-white transition-all"
                >
                  View Shop
                </button>
                <button
                  onClick={() => setShowProductForm(!showProductForm)}
                  className="flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-[#B8913D] to-[#A07F35] text-white rounded-full hover:shadow-xl transition-all hover:scale-105"
                >
                  {showProductForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                  <span>{showProductForm ? 'Cancel' : 'Add Product'}</span>
                </button>
              </div>
            </div>

            <div className="bg-gradient-to-br from-gray-800/60 to-gray-900/60 backdrop-blur-sm border border-gray-700/50 rounded-3xl p-6 shadow-xl">
              <div className="flex items-center mb-6">
                <Filter className="w-5 h-5 text-gold-400 mr-2" />
                <h3 className="text-lg font-medium text-white">Filtres</h3>
              </div>

              <div className="space-y-4">
                <div className="relative group">
                  <Search className="absolute left-5 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-gold-400 transition-colors" />
                  <input
                    type="text"
                    placeholder="Rechercher des produits..."
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    className="w-full pl-14 pr-12 py-4 bg-gray-900/50 border border-gray-700/50 rounded-2xl focus:border-gold-500 focus:ring-2 focus:ring-gold-500/20 outline-none shadow-sm text-white placeholder-gray-400 transition-all"
                  />
                  {productSearch && (
                    <button
                      onClick={() => setProductSearch('')}
                      className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white transition-colors p-1 hover:bg-gray-700/50 rounded-full"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-gray-900/50 border border-gray-700/50 rounded-2xl p-2">
                    <p className="text-xs text-gray-400 mb-2 px-3">Catégorie</p>
                    <div className="flex flex-col space-y-1">
                      <button
                        onClick={() => setProductCategoryFilter('all')}
                        className={`px-3 py-2 rounded-xl font-medium transition-all text-sm text-left ${
                          productCategoryFilter === 'all'
                            ? 'bg-gradient-to-r from-[#B8913D] to-[#D4AC5B] text-white shadow-lg'
                            : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
                        }`}
                      >
                        Tous
                      </button>
                      <button
                        onClick={() => setProductCategoryFilter('merchandise')}
                        className={`px-3 py-2 rounded-xl font-medium transition-all text-sm text-left ${
                          productCategoryFilter === 'merchandise'
                            ? 'bg-gradient-to-r from-[#B8913D] to-[#D4AC5B] text-white shadow-lg'
                            : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
                        }`}
                      >
                        Merchandise
                      </button>
                      <button
                        onClick={() => setProductCategoryFilter('event_pass')}
                        className={`px-3 py-2 rounded-xl font-medium transition-all text-sm text-left ${
                          productCategoryFilter === 'event_pass'
                            ? 'bg-gradient-to-r from-[#B8913D] to-[#D4AC5B] text-white shadow-lg'
                            : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
                        }`}
                      >
                        Event Pass
                      </button>
                    </div>
                  </div>

                  <div className="bg-gray-900/50 border border-gray-700/50 rounded-2xl p-2">
                    <p className="text-xs text-gray-400 mb-2 px-3">Statut</p>
                    <div className="flex flex-col space-y-1">
                      <button
                        onClick={() => setProductStatusFilter('all')}
                        className={`px-3 py-2 rounded-xl font-medium transition-all text-sm text-left ${
                          productStatusFilter === 'all'
                            ? 'bg-gradient-to-r from-[#B8913D] to-[#D4AC5B] text-white shadow-lg'
                            : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
                        }`}
                      >
                        Tous
                      </button>
                      <button
                        onClick={() => setProductStatusFilter('active')}
                        className={`px-3 py-2 rounded-xl font-medium transition-all text-sm text-left ${
                          productStatusFilter === 'active'
                            ? 'bg-gradient-to-r from-[#B8913D] to-[#D4AC5B] text-white shadow-lg'
                            : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
                        }`}
                      >
                        Actifs
                      </button>
                      <button
                        onClick={() => setProductStatusFilter('inactive')}
                        className={`px-3 py-2 rounded-xl font-medium transition-all text-sm text-left ${
                          productStatusFilter === 'inactive'
                            ? 'bg-gradient-to-r from-[#B8913D] to-[#D4AC5B] text-white shadow-lg'
                            : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
                        }`}
                      >
                        Inactifs
                      </button>
                    </div>
                  </div>

                  <div className="bg-gray-900/50 border border-gray-700/50 rounded-2xl p-2">
                    <p className="text-xs text-gray-400 mb-2 px-3">Stock</p>
                    <div className="flex flex-col space-y-1">
                      <button
                        onClick={() => setProductStockFilter('all')}
                        className={`px-3 py-2 rounded-xl font-medium transition-all text-sm text-left ${
                          productStockFilter === 'all'
                            ? 'bg-gradient-to-r from-[#B8913D] to-[#D4AC5B] text-white shadow-lg'
                            : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
                        }`}
                      >
                        Tous
                      </button>
                      <button
                        onClick={() => setProductStockFilter('in_stock')}
                        className={`px-3 py-2 rounded-xl font-medium transition-all text-sm text-left ${
                          productStockFilter === 'in_stock'
                            ? 'bg-gradient-to-r from-[#B8913D] to-[#D4AC5B] text-white shadow-lg'
                            : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
                        }`}
                      >
                        En stock
                      </button>
                      <button
                        onClick={() => setProductStockFilter('out_of_stock')}
                        className={`px-3 py-2 rounded-xl font-medium transition-all text-sm text-left ${
                          productStockFilter === 'out_of_stock'
                            ? 'bg-gradient-to-r from-[#B8913D] to-[#D4AC5B] text-white shadow-lg'
                            : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
                        }`}
                      >
                        Rupture de stock
                      </button>
                    </div>
                  </div>
                </div>

                {(productSearch || productCategoryFilter !== 'all' || productStatusFilter !== 'all' || productStockFilter !== 'all') && (
                  <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-700/50">
                    <span className="text-sm text-gray-400 mr-2">Filtres actifs:</span>
                    {productSearch && (
                      <span className="inline-flex items-center px-3 py-1 bg-gold-500/20 text-gold-300 rounded-full text-sm border border-gold-500/30">
                        <Search className="w-3 h-3 mr-1.5" />
                        {productSearch}
                        <button
                          onClick={() => setProductSearch('')}
                          className="ml-2 hover:text-white"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    )}
                    {productCategoryFilter !== 'all' && (
                      <span className="inline-flex items-center px-3 py-1 bg-gold-500/20 text-gold-300 rounded-full text-sm border border-gold-500/30">
                        <Filter className="w-3 h-3 mr-1.5" />
                        {productCategoryFilter === 'merchandise' ? 'Merchandise' : 'Event Pass'}
                        <button
                          onClick={() => setProductCategoryFilter('all')}
                          className="ml-2 hover:text-white"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    )}
                    {productStatusFilter !== 'all' && (
                      <span className="inline-flex items-center px-3 py-1 bg-gold-500/20 text-gold-300 rounded-full text-sm border border-gold-500/30">
                        <Filter className="w-3 h-3 mr-1.5" />
                        {productStatusFilter === 'active' ? 'Actifs' : 'Inactifs'}
                        <button
                          onClick={() => setProductStatusFilter('all')}
                          className="ml-2 hover:text-white"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    )}
                    {productStockFilter !== 'all' && (
                      <span className="inline-flex items-center px-3 py-1 bg-gold-500/20 text-gold-300 rounded-full text-sm border border-gold-500/30">
                        <Filter className="w-3 h-3 mr-1.5" />
                        {productStockFilter === 'in_stock' ? 'En stock' : 'Rupture de stock'}
                        <button
                          onClick={() => setProductStockFilter('all')}
                          className="ml-2 hover:text-white"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    )}
                    <button
                      onClick={() => {
                        setProductSearch('');
                        setProductCategoryFilter('all');
                        setProductStatusFilter('all');
                        setProductStockFilter('all');
                      }}
                      className="inline-flex items-center px-3 py-1 text-gray-400 hover:text-white text-sm transition-colors"
                    >
                      Réinitialiser tout
                    </button>
                  </div>
                )}
              </div>
            </div>

            {showProductForm && (
              <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl p-8 border border-gray-700/50">
                <h3 className="text-xl font-medium text-white mb-6">
                  {editingProduct ? 'Edit Product' : 'Add New Product'}
                </h3>
                <form onSubmit={handleProductSubmit} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Product Name *
                      </label>
                      <input
                        type="text"
                        value={productForm.name}
                        onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                        required
                        className="w-full px-4 py-3 bg-gray-900/50 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-[#B8913D] focus:border-transparent outline-none transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Category *
                      </label>
                      <select
                        value={productForm.category}
                        onChange={(e) => setProductForm({ ...productForm, category: e.target.value as any })}
                        className="w-full px-4 py-3 bg-gray-900/50 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-[#B8913D] focus:border-transparent outline-none transition-all"
                      >
                        <option value="merchandise">Merchandise</option>
                        <option value="event_pass">Event Pass</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Type de produit
                      </label>
                      <select
                        value={productForm.product_type_id}
                        onChange={(e) => {
                          const selectedType = (productTypes || []).find(t => t.id === e.target.value);
                          setProductForm({
                            ...productForm,
                            product_type_id: e.target.value,
                            type: selectedType?.name || '',
                            product_size_id: selectedType?.has_sizes ? productForm.product_size_id : ''
                          });
                        }}
                        className="w-full px-4 py-3 bg-gray-900/50 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-[#B8913D] focus:border-transparent outline-none transition-all"
                      >
                        <option value="">Sélectionner un type</option>
                        {(productTypes || []).filter(t => t.is_active).map((type) => (
                          <option key={type.id} value={type.id}>
                            {type.name} {type.has_sizes ? '(avec tailles)' : ''}
                          </option>
                        ))}
                      </select>
                    </div>

                    {productForm.product_type_id && (productTypes || []).find(t => t.id === productForm.product_type_id)?.has_sizes && (
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Taille *
                        </label>
                        <select
                          value={productForm.product_size_id}
                          onChange={(e) => setProductForm({ ...productForm, product_size_id: e.target.value })}
                          required
                          className="w-full px-4 py-3 bg-gray-900/50 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-[#B8913D] focus:border-transparent outline-none transition-all"
                        >
                          <option value="">Sélectionner une taille</option>
                          {((productTypes || []).find(t => t.id === productForm.product_type_id)?.sizes || [])
                            .map((size) => (
                              <option key={size} value={size}>
                                {size}
                              </option>
                            ))}
                        </select>
                      </div>
                    )}

                    {productForm.category === 'merchandise' && (
                      <>
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">
                            Price (€) *
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            value={productForm.price}
                            onChange={(e) => setProductForm({ ...productForm, price: parseFloat(e.target.value) || 0 })}
                            required
                            className="w-full px-4 py-3 bg-gray-900/50 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-[#B8913D] focus:border-transparent outline-none transition-all"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">
                            Member Price (€) *
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            value={productForm.member_price}
                            onChange={(e) => setProductForm({ ...productForm, member_price: parseFloat(e.target.value) || 0 })}
                            required
                            className="w-full px-4 py-3 bg-gray-900/50 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-[#B8913D] focus:border-transparent outline-none transition-all"
                          />
                        </div>
                      </>
                    )}

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Stock (-1 for unlimited)
                      </label>
                      <input
                        type="number"
                        value={productForm.stock}
                        onChange={(e) => setProductForm({ ...productForm, stock: parseInt(e.target.value) || 0 })}
                        className="w-full px-4 py-3 bg-gray-900/50 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-[#B8913D] focus:border-transparent outline-none transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Order Index
                      </label>
                      <input
                        type="number"
                        value={productForm.order_index}
                        onChange={(e) => setProductForm({ ...productForm, order_index: parseInt(e.target.value) || 0 })}
                        className="w-full px-4 py-3 bg-gray-900/50 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-[#B8913D] focus:border-transparent outline-none transition-all"
                      />
                    </div>

                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="is_active"
                        checked={productForm.is_active}
                        onChange={(e) => setProductForm({ ...productForm, is_active: e.target.checked })}
                        className="w-4 h-4 text-[#B8913D] border-gray-300 rounded focus:ring-[#B8913D]"
                      />
                      <label htmlFor="is_active" className="text-sm font-medium text-gray-300">
                        Active Product
                      </label>
                    </div>
                  </div>

                  {productForm.category === 'event_pass' && (
                    <div className="space-y-4 p-6 bg-gray-900/50 border border-[#B8913D]/30 rounded-xl">
                      <h4 className="text-lg font-medium text-[#B8913D] mb-4">Catégories de Prix</h4>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">
                            Nom de la catégorie *
                          </label>
                          <input
                            type="text"
                            value={newTicketCategory.name}
                            onChange={(e) => setNewTicketCategory({ ...newTicketCategory, name: e.target.value })}
                            className="w-full px-4 py-2 bg-gray-800 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-[#B8913D] focus:border-transparent outline-none"
                            placeholder="e.g., VIP, Standard"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">
                            Prix (€) *
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            value={newTicketCategory.price}
                            onChange={(e) => setNewTicketCategory({ ...newTicketCategory, price: parseFloat(e.target.value) || 0 })}
                            className="w-full px-4 py-2 bg-gray-800 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-[#B8913D] focus:border-transparent outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">
                            Prix Membre (€)
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            value={newTicketCategory.member_price}
                            onChange={(e) => setNewTicketCategory({ ...newTicketCategory, member_price: parseFloat(e.target.value) || 0 })}
                            className="w-full px-4 py-2 bg-gray-800 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-[#B8913D] focus:border-transparent outline-none"
                          />
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={handleAddTicketCategory}
                        className="flex items-center space-x-2 px-4 py-2 bg-[#B8913D] text-white rounded-lg hover:bg-[#A07F35] transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Ajouter cette catégorie</span>
                      </button>

                      {ticketCategories.length > 0 && (
                        <div className="space-y-2 mt-4">
                          <p className="text-sm font-medium text-gray-300">Catégories ajoutées:</p>
                          {ticketCategories.map((category, index) => (
                            <div
                              key={index}
                              className="flex items-center justify-between p-3 bg-gray-800 border border-gray-700 rounded-lg"
                            >
                              <div className="flex-1">
                                <span className="text-white font-medium">{category.name}</span>
                                <span className="text-gray-400 ml-4">
                                  Prix: {category.price}€
                                  {category.member_price > 0 && ` | Membre: ${category.member_price}€`}
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleRemoveTicketCategory(index)}
                                className="p-2 text-red-400 hover:text-red-300 hover:bg-red-400/10 rounded-lg transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Description
                    </label>
                    <textarea
                      value={productForm.description}
                      onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
                      rows={3}
                      className="w-full px-4 py-3 bg-gray-900/50 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-[#B8913D] focus:border-transparent outline-none transition-all"
                    />
                  </div>

                  <ImageUpload
                    currentImageUrl={productForm.image_url}
                    onImageUrlChange={(url) => setProductForm({ ...productForm, image_url: url })}
                    label="Product Image"
                  />

                  <div className="flex justify-end space-x-3">
                    <button
                      type="button"
                      onClick={resetProductForm}
                      className="px-6 py-3 border border-gray-600 text-gray-300 rounded-lg hover:bg-gray-700/50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-6 py-3 bg-gradient-to-r from-[#B8913D] to-[#A07F35] text-white rounded-lg hover:shadow-lg transition-all"
                    >
                      {editingProduct ? 'Update Product' : 'Add Product'}
                    </button>
                  </div>
                </form>
              </div>
            )}

            <div className="grid grid-cols-1 gap-4">
              {products
                .filter(product => {
                  const query = productSearch.toLowerCase();
                  const matchesSearch = !productSearch ||
                    product.name.toLowerCase().includes(query) ||
                    product.description.toLowerCase().includes(query);

                  const matchesCategory = productCategoryFilter === 'all' ||
                    product.category === productCategoryFilter;

                  const matchesStatus = productStatusFilter === 'all' ||
                    (productStatusFilter === 'active' && product.is_active) ||
                    (productStatusFilter === 'inactive' && !product.is_active);

                  const matchesStock = productStockFilter === 'all' ||
                    (productStockFilter === 'in_stock' && (product.stock > 0 || product.stock === -1)) ||
                    (productStockFilter === 'out_of_stock' && product.stock === 0);

                  return matchesSearch && matchesCategory && matchesStatus && matchesStock;
                })
                .map((product) => (
                <div
                  key={product.id}
                  className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-6 border border-gray-700/50 group"
                >
                  <div className="flex items-start space-x-4">
                    <div className="w-20 h-20 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                      {product.image_url ? (
                        <img
                          src={product.image_url}
                          alt={product.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <ShoppingBag className="w-8 h-8 text-gray-300" />
                        </div>
                      )}
                    </div>

                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <h3 className="text-lg font-medium text-white">{product.name}</h3>
                        <span className={`px-3 py-1 rounded-full text-xs font-medium border ${
                          product.category === 'event_pass' ? 'bg-amber-500/20 text-amber-300 border-amber-500/30' :
                          'bg-blue-500/20 text-blue-300 border-blue-500/30'
                        }`}>
                          {product.category}
                        </span>
                        {!product.is_active && (
                          <span className="px-3 py-1 bg-red-500/20 text-red-300 rounded-full text-xs font-medium border border-red-500/30">
                            Inactive
                          </span>
                        )}
                      </div>
                      <p className="text-gray-300 text-sm mb-2">{product.description}</p>
                      {product.category === 'event_pass' && product.details && (product.details as any).ticket_categories && ((product.details as any).ticket_categories as any[]).length > 0 ? (
                        <div className="space-y-1 mb-2">
                          <p className="text-xs text-gray-400 mb-1">Catégories de prix:</p>
                          {((product.details as any).ticket_categories as any[]).map((cat: any, idx: number) => (
                            <div key={idx} className="flex items-center space-x-2 text-xs">
                              <span className="text-white font-medium">{cat.name}:</span>
                              <span className="text-gray-300">{cat.price}€</span>
                              {cat.member_price > 0 && (
                                <span className="text-[#B8913D]">(Membre: {cat.member_price}€)</span>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="flex items-center space-x-4 text-sm">
                          <span className="font-medium text-white">
                            Price: {product.price.toFixed(2)}€
                          </span>
                          <span className="text-[#B8913D]">
                            Member: {product.member_price.toFixed(2)}€
                          </span>
                        </div>
                      )}
                      <div className="flex items-center space-x-4 text-sm mt-2">
                        <span className={product.stock === 0 ? 'text-red-300' : 'text-gray-300'}>
                          Stock: {product.stock === -1 ? 'Unlimited' : product.stock}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2 ml-4 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleEditProduct(product)}
                        className="p-2 text-[#B8913D] hover:bg-[#B8913D] hover:bg-opacity-10 rounded-lg transition-colors"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteProduct(product.id)}
                        className="p-2 text-red-400 hover:bg-red-400 hover:bg-opacity-10 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : activeTab === 'orders' ? (
          <div className="space-y-6">
            <h2 className="text-2xl font-light text-white">Order Management</h2>

            <div className="space-y-4">
              {orders.map((order) => (
                <div
                  key={order.id}
                  className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-6 border border-gray-700/50"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <div className="flex items-center space-x-3 mb-2">
                        <h3 className="text-lg font-medium text-white">
                          {order.profiles?.full_name || 'Unknown User'}
                        </h3>
                        <span className={`px-3 py-1 rounded-full text-xs font-medium border ${
                          order.status === 'completed' ? 'bg-green-500/20 text-green-300 border-green-500/30' :
                          order.status === 'cancelled' ? 'bg-red-500/20 text-red-300 border-red-500/30' :
                          order.status === 'shipped' ? 'bg-blue-500/20 text-blue-300 border-blue-500/30' :
                          order.status === 'processing' ? 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30' :
                          'bg-gray-500/20 text-gray-300 border-gray-500/30'
                        }`}>
                          {order.status}
                        </span>
                        {order.is_member_order && (
                          <span className="px-3 py-1 bg-[#B8913D] bg-opacity-10 text-[#B8913D] rounded-full text-xs font-medium">
                            Member Order
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-400">{order.profiles?.email}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {new Date(order.created_at).toLocaleString('fr-FR')}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-[#B8913D]">
                        {order.total_amount.toFixed(2)}€
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-gray-700/50 pt-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-gray-400 mb-1">Shipping Info:</p>
                        <p className="text-white font-medium">{order.shipping_name}</p>
                        <p className="text-gray-300">{order.shipping_email}</p>
                        {order.shipping_phone && (
                          <p className="text-gray-300">{order.shipping_phone}</p>
                        )}
                      </div>
                      <div>
                        <p className="text-gray-400 mb-1">Address:</p>
                        <p className="text-white">{order.shipping_address}</p>
                        {order.notes && (
                          <>
                            <p className="text-gray-400 mt-2 mb-1">Notes:</p>
                            <p className="text-gray-300">{order.notes}</p>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="mt-4 flex space-x-2">
                      <select
                        value={order.status}
                        onChange={async (e) => {
                          const { error } = await supabase
                            .from('orders')
                            .update({ status: e.target.value, updated_at: new Date().toISOString() })
                            .eq('id', order.id);

                          if (!error) {
                            await loadOrders();
                            setSuccess('Order status updated');
                            setTimeout(() => setSuccess(''), 3000);
                          }
                        }}
                        className="px-4 py-2 bg-gray-900/50 border border-gray-600 text-white rounded-lg text-sm focus:ring-2 focus:ring-[#B8913D] focus:border-transparent outline-none"
                      >
                        <option value="pending">Pending</option>
                        <option value="paid">Paid</option>
                        <option value="processing">Processing</option>
                        <option value="shipped">Shipped</option>
                        <option value="completed">Completed</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : activeTab === 'product-types' ? (
          <ProductTypesManagement
            productTypes={productTypes || []}
            onRefresh={loadProductTypes}
            setError={setError}
            setSuccess={setSuccess}
          />
        ) : activeTab === 'events' ? (
          <EventsManagement />
        ) : activeTab === 'ticket-types' ? (
          <TicketTypesManagement />
        ) : activeTab === 'payments' ? (
          <ProfessorPayments />
        ) : null}
      </div>
    </div>
  );
}
