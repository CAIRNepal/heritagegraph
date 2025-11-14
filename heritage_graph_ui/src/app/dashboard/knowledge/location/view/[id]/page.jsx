'use client';

import { useParams, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import {
  User, CheckCircle, Calendar, ArrowLeft,
  MapPin, Tag, Clock, XCircle, Edit, FileText
} from 'lucide-react';

import { Table, TableBody, TableCell, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast, Toaster } from 'sonner';

function SubmissionLayout({ entity, children, currentTab, onTabChange }) {
  const router = useRouter();

  return (
    <div className="space-y-6">
      <Button variant="ghost" onClick={() => router.push('/dashboard/knowledge/location')}>
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Locations
      </Button>

      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">{entity.name}</CardTitle>

          <div className="flex gap-2 mt-2">
            <Badge variant="outline" className="flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              Location
            </Badge>

            <Badge variant="secondary" className="flex items-center gap-1">
              {entity.type}
            </Badge>
          </div>

          {entity.description && (
            <CardDescription className="mt-3">{entity.description}</CardDescription>
          )}
        </CardHeader>
      </Card>

      <div className="@4xl/main:hidden">
        <Select value={currentTab} onValueChange={onTabChange}>
          <SelectTrigger>
            <SelectValue placeholder="Select a view" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="details">Details</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Tabs value={currentTab} onValueChange={onTabChange} className="hidden @4xl/main:block">
        <TabsList className="grid w-full grid-cols-1">
          <TabsTrigger value="details">Location Details</TabsTrigger>
        </TabsList>
      </Tabs>

      {children}
    </div>
  );
}

export default function LocationPage() {
  const params = useParams();
  const locationId = params?.id;

  const [entity, setEntity] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentTab, setCurrentTab] = useState('details');
  const [error, setError] = useState(null);

  const API_BASE = "http://0.0.0.0:8000/cidoc/locations";

  useEffect(() => {
    if (!locationId) return;

    const fetchLocation = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const res = await fetch(`${API_BASE}/${locationId}/`);
        if (!res.ok) throw new Error("Failed to load location");

        const data = await res.json();
        setEntity(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchLocation();
  }, [locationId]);

  const renderDetails = () => {
    if (!entity) return null;

    const fields = {
      "Name": entity.name,
      "Coordinates": entity.coordinates,
      "Type": entity.type,
      "Current Status": entity.current_status,
      "Historical Period": entity.historical_period,
      "Description": entity.description,
    };

    return (
      <Card>
        <CardHeader>
          <CardTitle>Location Details</CardTitle>
          <CardDescription>Complete information from CIDOC API</CardDescription>
        </CardHeader>

        <CardContent>
          <Table>
            <TableBody>
              {Object.entries(fields).map(([label, value]) => (
                <TableRow key={label}>
                  <TableCell className="font-medium w-1/3">{label}</TableCell>
                  <TableCell>{value || "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    );
  };

  if (isLoading) return <div className="p-10">Loading Location…</div>;
  if (error) return <div className="text-red-500 p-10">{error}</div>;
  if (!entity) return <div className="p-10">Location Not Found</div>;

  return (
    <>
      <Toaster position="top-right" richColors />
      <SubmissionLayout
        entity={entity}
        currentTab={currentTab}
        onTabChange={setCurrentTab}
      >
        {currentTab === "details" && renderDetails()}
      </SubmissionLayout>
    </>
  );
}
