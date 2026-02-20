import { useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { X, Loader2, Image as ImageIcon, Plus, GripVertical } from 'lucide-react';

interface ProductImage {
  id?: string;
  image_url: string;
  order_index: number;
  isNew?: boolean;
}

interface ProductImagesUploadProps {
  images: ProductImage[];
  onChange: (images: ProductImage[]) => void;
  label?: string;
}

export function ProductImagesUpload({ images, onChange, label = 'Photos du produit' }: ProductImagesUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resizeImage = (file: File): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          if (!ctx) { reject(new Error('Could not get canvas context')); return; }

          let { width, height } = img;
          const maxSize = 1200;
          if (width > height) {
            if (width > maxSize) { height = height * (maxSize / width); width = maxSize; }
          } else {
            if (height > maxSize) { width = width * (maxSize / height); height = maxSize; }
          }

          canvas.width = width;
          canvas.height = height;
          ctx.drawImage(img, 0, 0, width, height);
          canvas.toBlob(
            (blob) => { if (blob) resolve(blob); else reject(new Error('Failed to create blob')); },
            'image/jpeg',
            0.85
          );
        };
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  };

  const handleFilesSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    const invalidFiles = files.filter(f => !f.type.startsWith('image/'));
    if (invalidFiles.length > 0) { setError('Certains fichiers ne sont pas des images'); return; }

    const oversizedFiles = files.filter(f => f.size > 10 * 1024 * 1024);
    if (oversizedFiles.length > 0) { setError('Certaines images dépassent 10MB'); return; }

    if (images.length + files.length > 8) {
      setError('Maximum 8 photos par produit');
      return;
    }

    setUploading(true);
    setError('');

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Vous devez être connecté pour uploader des images');

      const newImages: ProductImage[] = [];

      for (const file of files) {
        const resizedBlob = await resizeImage(file);
        const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.jpg`;
        const filePath = `${user.id}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('images')
          .upload(filePath, resizedBlob, { cacheControl: '3600', upsert: false, contentType: 'image/jpeg' });

        if (uploadError) throw uploadError;

        const { data, error: signedUrlError } = await supabase.storage
          .from('images')
          .createSignedUrl(filePath, 31536000);

        if (signedUrlError) throw signedUrlError;

        newImages.push({
          image_url: data.signedUrl,
          order_index: images.length + newImages.length,
          isNew: true,
        });
      }

      onChange([...images, ...newImages]);
    } catch (err: any) {
      setError(err.message || 'Erreur lors de l\'upload');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemove = (index: number) => {
    const updated = images.filter((_, i) => i !== index).map((img, i) => ({ ...img, order_index: i }));
    onChange(updated);
  };

  const handleDragStart = (index: number) => {
    setDragIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverIndex(index);
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (dragIndex === null || dragIndex === dropIndex) {
      setDragIndex(null);
      setDragOverIndex(null);
      return;
    }

    const reordered = [...images];
    const [moved] = reordered.splice(dragIndex, 1);
    reordered.splice(dropIndex, 0, moved);
    onChange(reordered.map((img, i) => ({ ...img, order_index: i })));
    setDragIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDragIndex(null);
    setDragOverIndex(null);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-gray-300">{label}</label>
        <span className="text-xs text-gray-500">{images.length}/8 photos</span>
      </div>

      {images.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {images.map((img, index) => (
            <div
              key={index}
              draggable
              onDragStart={() => handleDragStart(index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDrop={(e) => handleDrop(e, index)}
              onDragEnd={handleDragEnd}
              className={`relative group aspect-square bg-gray-800 rounded-lg overflow-hidden border-2 transition-all cursor-grab active:cursor-grabbing ${
                index === 0
                  ? 'border-[#B8913D]'
                  : dragOverIndex === index
                  ? 'border-[#B8913D] border-dashed scale-105'
                  : 'border-gray-700 hover:border-gray-500'
              } ${dragIndex === index ? 'opacity-50' : 'opacity-100'}`}
            >
              <img src={img.image_url} alt={`Photo ${index + 1}`} className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-all" />

              {index === 0 && (
                <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 bg-[#B8913D] text-white text-[9px] font-bold rounded">
                  Principal
                </div>
              )}

              <div className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  type="button"
                  onClick={() => handleRemove(index)}
                  className="p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>

              <div className="absolute bottom-1.5 left-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="p-1 bg-black bg-opacity-60 rounded text-gray-300">
                  <GripVertical className="w-3 h-3" />
                </div>
              </div>
            </div>
          ))}

          {images.length < 8 && (
            <label className={`aspect-square bg-gray-800 rounded-lg border-2 border-dashed border-gray-600 hover:border-[#B8913D] transition-colors flex flex-col items-center justify-center cursor-pointer ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
              {uploading ? (
                <Loader2 className="w-6 h-6 text-[#B8913D] animate-spin" />
              ) : (
                <>
                  <Plus className="w-6 h-6 text-gray-500 mb-1" />
                  <span className="text-xs text-gray-500">Ajouter</span>
                </>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleFilesSelect}
                className="hidden"
              />
            </label>
          )}
        </div>
      )}

      {images.length === 0 && (
        <div className={`w-full h-40 bg-gray-800 rounded-lg border-2 border-dashed border-gray-600 hover:border-[#B8913D] transition-colors flex items-center justify-center ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
          {uploading ? (
            <div className="text-center">
              <Loader2 className="w-8 h-8 text-[#B8913D] mx-auto mb-2 animate-spin" />
              <p className="text-sm text-gray-400">Upload en cours...</p>
            </div>
          ) : (
            <label className="cursor-pointer text-center p-4 w-full h-full flex flex-col items-center justify-center">
              <ImageIcon className="w-10 h-10 text-gray-500 mx-auto mb-2" />
              <p className="text-sm text-gray-400 mb-1">Cliquez pour ajouter des photos</p>
              <p className="text-xs text-gray-500">Plusieurs fichiers acceptés • Max 8 photos • 10MB chacune</p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleFilesSelect}
                className="hidden"
              />
            </label>
          )}
        </div>
      )}

      {images.length > 1 && (
        <p className="text-xs text-gray-500">Glissez les photos pour réorganiser. La 1ère photo est l'image principale.</p>
      )}

      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  );
}
