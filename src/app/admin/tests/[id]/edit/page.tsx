'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface Test {
  _id: string;
  title: string;
  status: string;
}

export default function EditTestPage() {
  const router = useRouter();
  const params = useParams();
  const testId = params.id as string;

  const [title, setTitle] = useState('');
  const [status, setStatus] = useState('draft');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Fetch current test
  useEffect(() => {
    fetch(`/api/tests/${testId}`)
      .then(res => res.json())
      .then(data => {
        setTitle(data.title);
        setStatus(data.status);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [testId]);

  const handleUpdate = async () => {
    setSaving(true);

    const res = await fetch(`/api/tests/${testId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, status })
    });

    setSaving(false);

    if (res.ok) {
      router.push('/admin');
    } else {
      alert('Failed to update test');
    }
  };

  if (loading) return <div className="p-6">Loading test...</div>;

  return (
    <div className="container mx-auto p-6 max-w-xl">
      <Card>
        <CardHeader>
          <CardTitle>Edit Test</CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium">Test Title</label>
            <Input
              value={title}
              onChange={e => setTitle(e.target.value)}
            />
          </div>

          <div>
            <label className="text-sm font-medium">Status</label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="published">Published</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button onClick={handleUpdate} disabled={saving}>
            {saving ? 'Saving...' : 'Update Test'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
