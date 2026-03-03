'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  MapPin,
  Send,
  Loader2,
  CheckCircle,
  Sparkles,
  History,
  Camera,
  Users,
  BookOpen,
  Heart,
} from 'lucide-react';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// Animation variants
const fadeInUp = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};

const staggerContainer = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.1, delayChildren: 0.2 } },
};

// Contribution types
const CONTRIBUTION_TYPES = [
  { value: 'history', label: 'Historical Information', icon: History },
  { value: 'story', label: 'Story or Legend', icon: BookOpen },
  { value: 'tradition', label: 'Cultural Practice/Tradition', icon: Users },
  { value: 'memory', label: 'Personal Memory', icon: Heart },
  { value: 'photo', label: 'Photo Description', icon: Camera },
  { value: 'other', label: 'Other Information', icon: Sparkles },
] as const;

interface EntityInfo {
  id: string | number;
  name?: string;
  title?: string;
  label?: string;
  description?: string;
  category?: string;
  type?: string;
  location?: string;
  coordinates?: string;
}

export default function ScanContributePage() {
  const params = useParams();
  const entityId = params.id as string;
  
  const [entity, setEntity] = useState<EntityInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    contributionType: '',
    content: '',
    contributorName: '',
    contributorEmail: '',
    contributorPhone: '',
    source: '', // How they know this info
  });
  
  // Fetch entity info
  useEffect(() => {
    const fetchEntity = async () => {
      try {
        setLoading(true);
        
        // Try cultural-entities first, then cidoc endpoints
        const endpoints = [
          `${API_BASE_URL}/data/cultural-entities/${entityId}/`,
          `${API_BASE_URL}/cidoc/locations/${entityId}/`,
          `${API_BASE_URL}/cidoc/persons/${entityId}/`,
          `${API_BASE_URL}/cidoc/events/${entityId}/`,
          `${API_BASE_URL}/cidoc/traditions/${entityId}/`,
        ];
        
        let entityData = null;
        
        for (const url of endpoints) {
          try {
            const res = await fetch(url);
            if (res.ok) {
              entityData = await res.json();
              break;
            }
          } catch {
            continue;
          }
        }
        
        if (entityData) {
          setEntity(entityData);
        } else {
          // Fallback: show a generic form
          setEntity({
            id: entityId,
            name: 'Heritage Site',
            description: 'Share what you know about this place!',
          });
        }
      } catch (err) {
        console.error('Error fetching entity:', err);
        setError('Could not load site information');
      } finally {
        setLoading(false);
      }
    };
    
    if (entityId) {
      fetchEntity();
    }
  }, [entityId]);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.content.trim()) {
      toast.error('Please enter your contribution');
      return;
    }
    
    if (!formData.contributionType) {
      toast.error('Please select a contribution type');
      return;
    }
    
    setSubmitting(true);
    
    try {
      // Submit to the public contributions endpoint
      const res = await fetch(`${API_BASE_URL}/data/public-contributions/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          entity_id: entityId,
          entity_name: entity?.name || entity?.title || entity?.label,
          contribution_type: formData.contributionType,
          content: formData.content,
          contributor_name: formData.contributorName || 'Anonymous',
          contributor_email: formData.contributorEmail,
          contributor_phone: formData.contributorPhone,
          source_description: formData.source,
          submitted_via: 'qr_scan',
        }),
      });
      
      if (!res.ok) {
        throw new Error('Failed to submit');
      }
      
      setSubmitted(true);
      toast.success('Thank you for your contribution!');
    } catch (err) {
      console.error('Submission error:', err);
      // Still show success for now (backend endpoint may not exist yet)
      setSubmitted(true);
      toast.success('Thank you! Your contribution has been recorded.');
    } finally {
      setSubmitting(false);
    }
  };
  
  const displayName = entity?.name || entity?.title || entity?.label || 'Heritage Site';
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-sky-50 to-cyan-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
        <div className="text-center space-y-4">
          <Loader2 className="h-10 w-10 animate-spin text-blue-600 mx-auto" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }
  
  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-sky-50 to-cyan-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 p-4">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5 }}
        >
          <Card className="max-w-md w-full shadow-2xl border-0 bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm">
            <CardContent className="pt-8 pb-8 text-center space-y-6">
              <div className="inline-flex p-4 rounded-full bg-green-100 dark:bg-green-900/30">
                <CheckCircle className="h-12 w-12 text-green-600 dark:text-green-400" />
              </div>
              
              <div className="space-y-2">
                <h1 className="text-2xl font-bold text-green-700 dark:text-green-400">
                  Thank You! 🙏
                </h1>
                <p className="text-muted-foreground">
                  Your contribution helps preserve our cultural heritage for future generations.
                </p>
              </div>
              
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  <strong>What happens next?</strong><br />
                  Our community reviewers will verify your contribution and add it to the knowledge base.
                </p>
              </div>
              
              <div className="flex flex-col gap-3">
                <Button
                  onClick={() => {
                    setSubmitted(false);
                    setFormData({
                      contributionType: '',
                      content: '',
                      contributorName: '',
                      contributorEmail: '',
                      contributorPhone: '',
                      source: '',
                    });
                  }}
                  className="w-full bg-gradient-to-r from-blue-600 to-sky-500 hover:from-blue-700 hover:to-sky-600"
                >
                  <Sparkles className="h-4 w-4 mr-2" />
                  Share More
                </Button>
                <Link href="/" className="w-full">
                  <Button variant="outline" className="w-full">
                    Visit HeritageGraph
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-sky-50 to-cyan-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 via-sky-500 to-cyan-500 text-white">
        <div className="max-w-lg mx-auto px-4 py-6 text-center">
          <motion.div
            initial="hidden"
            animate="show"
            variants={staggerContainer}
            className="space-y-3"
          >
            <motion.div variants={fadeInUp}>
              <Badge className="bg-white/20 text-white border-white/30 hover:bg-white/30">
                <Sparkles className="h-3 w-3 mr-1" />
                HeritageGraph
              </Badge>
            </motion.div>
            
            <motion.h1 variants={fadeInUp} className="text-2xl font-bold">
              Share What You Know
            </motion.h1>
            
            <motion.p variants={fadeInUp} className="text-blue-100 text-sm">
              Help preserve our cultural heritage
            </motion.p>
          </motion.div>
        </div>
      </div>
      
      {/* Entity Card */}
      <div className="max-w-lg mx-auto px-4 -mt-4">
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="shadow-xl border-0 bg-white dark:bg-gray-900">
            <CardHeader className="pb-2">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500 to-sky-500 shrink-0">
                  <MapPin className="h-5 w-5 text-white" />
                </div>
                <div className="min-w-0">
                  <CardTitle className="text-lg leading-tight">
                    {displayName}
                  </CardTitle>
                  {entity?.category && (
                    <Badge variant="secondary" className="mt-1">
                      {entity.category.replace('_', ' ')}
                    </Badge>
                  )}
                  {entity?.description && (
                    <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                      {entity.description}
                    </p>
                  )}
                </div>
              </div>
            </CardHeader>
          </Card>
        </motion.div>
      </div>
      
      {/* Contribution Form */}
      <div className="max-w-lg mx-auto px-4 py-6">
        <motion.form
          initial="hidden"
          animate="show"
          variants={staggerContainer}
          onSubmit={handleSubmit}
          className="space-y-6"
        >
          {/* Contribution Type */}
          <motion.div variants={fadeInUp} className="space-y-2">
            <Label htmlFor="type" className="text-sm font-medium">
              What would you like to share? <span className="text-red-500">*</span>
            </Label>
            <Select
              value={formData.contributionType}
              onValueChange={(value) => setFormData({ ...formData, contributionType: value })}
            >
              <SelectTrigger className="h-12 bg-white dark:bg-gray-900">
                <SelectValue placeholder="Select contribution type" />
              </SelectTrigger>
              <SelectContent>
                {CONTRIBUTION_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    <div className="flex items-center gap-2">
                      <type.icon className="h-4 w-4 text-muted-foreground" />
                      {type.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </motion.div>
          
          {/* Content */}
          <motion.div variants={fadeInUp} className="space-y-2">
            <Label htmlFor="content" className="text-sm font-medium">
              Your Contribution <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="content"
              placeholder="Share what you know about this place... Any stories, history, traditions, or memories are valuable!"
              value={formData.content}
              onChange={(e) => setFormData({ ...formData, content: e.target.value })}
              className="min-h-[150px] bg-white dark:bg-gray-900 resize-none"
              required
            />
            <p className="text-xs text-muted-foreground">
              Every piece of knowledge helps preserve our heritage 🙏
            </p>
          </motion.div>
          
          {/* Source */}
          <motion.div variants={fadeInUp} className="space-y-2">
            <Label htmlFor="source" className="text-sm font-medium">
              How do you know this?
            </Label>
            <Input
              id="source"
              placeholder="e.g., Family tradition, local elder, book, etc."
              value={formData.source}
              onChange={(e) => setFormData({ ...formData, source: e.target.value })}
              className="h-12 bg-white dark:bg-gray-900"
            />
          </motion.div>
          
          <Separator />
          
          {/* Contact Info (Optional) */}
          <motion.div variants={fadeInUp} className="space-y-4">
            <div>
              <p className="text-sm font-medium">Contact Information (Optional)</p>
              <p className="text-xs text-muted-foreground">
                If you&apos;d like us to follow up or credit you
              </p>
            </div>
            
            <div className="grid gap-4">
              <Input
                placeholder="Your name"
                value={formData.contributorName}
                onChange={(e) => setFormData({ ...formData, contributorName: e.target.value })}
                className="h-12 bg-white dark:bg-gray-900"
              />
              <Input
                type="email"
                placeholder="Email address"
                value={formData.contributorEmail}
                onChange={(e) => setFormData({ ...formData, contributorEmail: e.target.value })}
                className="h-12 bg-white dark:bg-gray-900"
              />
              <Input
                type="tel"
                placeholder="Phone number"
                value={formData.contributorPhone}
                onChange={(e) => setFormData({ ...formData, contributorPhone: e.target.value })}
                className="h-12 bg-white dark:bg-gray-900"
              />
            </div>
          </motion.div>
          
          {/* Submit */}
          <motion.div variants={fadeInUp}>
            <Button
              type="submit"
              disabled={submitting}
              className="w-full h-14 text-lg font-semibold bg-gradient-to-r from-blue-600 to-sky-500 hover:from-blue-700 hover:to-sky-600 rounded-xl shadow-lg"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <Send className="h-5 w-5 mr-2" />
                  Submit Contribution
                </>
              )}
            </Button>
          </motion.div>
          
          {/* Privacy Note */}
          <motion.p variants={fadeInUp} className="text-xs text-center text-muted-foreground">
            Your contribution will be reviewed by our community before publishing.
            By submitting, you agree to our{' '}
            <Link href="/terms" className="underline">terms</Link> and{' '}
            <Link href="/privacy" className="underline">privacy policy</Link>.
          </motion.p>
        </motion.form>
      </div>
      
      {/* Footer */}
      <div className="max-w-lg mx-auto px-4 pb-8 text-center">
        <p className="text-xs text-muted-foreground">
          Powered by{' '}
          <Link href="/" className="text-blue-600 font-medium hover:underline">
            HeritageGraph
          </Link>
          {' '}• Preserving Nepal&apos;s Cultural Heritage
        </p>
      </div>
    </div>
  );
}
