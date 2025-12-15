'use client';

import { useState, useCallback, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { ImagePlus, Loader2, Upload, X } from 'lucide-react';
import Image from 'next/image';

interface ImageUploadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: {
    image: string; // base64 data URL
    subsection: string; // file path
    subsectionName: string; // display name
    comment?: string;
    verbosity: 'low' | 'medium' | 'high';
  }) => Promise<void>;
  subsections: Array<{ name: string; path: string }>;
}

export function ImageUploadModal({
  open,
  onOpenChange,
  onSubmit,
  subsections,
}: ImageUploadModalProps) {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [subsection, setSubsection] = useState<string>('');
  const [comment, setComment] = useState<string>('');
  const [verbosity, setVerbosity] = useState<number>(1); // 0=low, 1=medium, 2=high
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageSelect = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      setSelectedImage(result);
      setSelectedFile(file);
    };
    reader.readAsDataURL(file);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) {
        handleImageSelect(file);
      }
    },
    [handleImageSelect]
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        handleImageSelect(file);
      }
    },
    [handleImageSelect]
  );

  const handleSubmit = async () => {
    if (!selectedImage || !subsection) {
      return;
    }

    const selectedSubsection = subsections.find((s) => s.path === subsection);
    if (!selectedSubsection) {
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit({
        image: selectedImage,
        subsection: selectedSubsection.path,
        subsectionName: selectedSubsection.name,
        comment: comment.trim() || undefined,
        verbosity: ['low', 'medium', 'high'][verbosity] as
          | 'low'
          | 'medium'
          | 'high',
      });

      // reset form
      setSelectedImage(null);
      setSelectedFile(null);
      setSubsection('');
      setComment('');
      setVerbosity(1);
      onOpenChange(false);
    } catch (error) {
      console.error('Error submitting image:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemoveImage = () => {
    setSelectedImage(null);
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setSelectedImage(null);
      setSelectedFile(null);
      setSubsection('');
      setComment('');
      setVerbosity(1);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Upload Image for Analysis</DialogTitle>
          <DialogDescription>
            Upload an image to integrate it into the LaTeX content and generate
            suggestions based on the image content.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Image Upload Area */}
          <div>
            <Label>Image</Label>
            {!selectedImage ? (
              <div
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                className="mt-2 flex h-48 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 transition-colors hover:border-primary hover:bg-slate-100"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="mb-2 h-8 w-8 text-slate-400" />
                <p className="text-sm font-medium text-slate-600">
                  Click to upload or drag and drop
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  PNG, JPG, JPEG, GIF up to 10MB
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>
            ) : (
              <div className="relative mt-2 rounded-lg border border-slate-200 bg-white p-4">
                <button
                  onClick={handleRemoveImage}
                  className="absolute right-2 top-2 rounded-full bg-white p-1 shadow-md hover:bg-slate-100"
                  disabled={isSubmitting}
                >
                  <X className="h-4 w-4" />
                </button>
                <div className="flex min-w-0 items-start gap-4">
                  <div className="relative h-32 w-32 flex-shrink-0 overflow-hidden rounded-md">
                    <Image
                      src={selectedImage}
                      alt="Preview"
                      fill
                      className="object-cover"
                    />
                  </div>
                  <div className="flex-1">
                    <p className="whitespace-normal break-words break-all font-medium text-slate-900">
                      {selectedFile?.name}
                    </p>
                    <p className="whitespace-normal break-words text-sm text-slate-500">
                      {selectedFile
                        ? `${(selectedFile.size / 1024).toFixed(1)} KB`
                        : ''}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Subsection Selector */}
          <div>
            <Label htmlFor="subsection">Target Subsection *</Label>
            <Select value={subsection} onValueChange={setSubsection}>
              <SelectTrigger id="subsection" className="mt-2">
                <SelectValue placeholder="Select a subsection file" />
              </SelectTrigger>
              <SelectContent>
                {subsections.length === 0 ? (
                  <SelectItem value="none" disabled>
                    No subsection files found
                  </SelectItem>
                ) : (
                  subsections.map((section) => (
                    <SelectItem key={section.path} value={section.path}>
                      {section.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            <p className="mt-1 text-xs text-slate-500">
              Select the subsection file where the image content should be
              integrated
            </p>
          </div>

          {/* Verbosity Slider */}
          <div>
            <div className="flex items-center justify-between">
              <Label>Description Verbosity</Label>
              <span className="text-sm font-medium text-slate-700">
                {['Low', 'Medium', 'High'][verbosity]}
              </span>
            </div>
            <div className="mt-3 px-2">
              <Slider
                value={[verbosity]}
                onValueChange={([val]) => setVerbosity(val)}
                min={0}
                max={2}
                step={1}
                disabled={isSubmitting}
                className="cursor-pointer"
              />
              <div className="mt-2 flex justify-between text-xs text-slate-500">
                <span>Low</span>
                <span>Medium</span>
                <span>High</span>
              </div>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Controls how detailed the image description and caption should be
            </p>
          </div>

          {/* Optional Comment */}
          <div>
            <Label htmlFor="comment">Additional Comments (Optional)</Label>
            <Textarea
              id="comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Add any specific instructions or context for the AI..."
              className="mt-2 min-h-[100px]"
              disabled={isSubmitting}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!selectedImage || !subsection || isSubmitting}
            className="gap-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <ImagePlus className="h-4 w-4" />
                Generate Suggestions
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
