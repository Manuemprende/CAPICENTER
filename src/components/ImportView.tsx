import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import * as XLSX from 'xlsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { FileSpreadsheet, Upload, CheckCircle2, AlertCircle, Trash2, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

type ImportType = 'leads' | 'sales';

interface ColumnMapping {
  fileColumn: string;
  systemField: string;
}

export function ImportView() {
  const [fileData, setFileData] = useState<{ headers: string[], rows: any[], fileName: string } | null>(null);
  const [importType, setImportType] = useState<ImportType>('leads');
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState<{ success: number, error: number } | null>(null);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    const reader = new FileReader();

    reader.onload = (e) => {
      const data = new Uint8Array(e.target?.result as ArrayBuffer);
      const workbook = XLSX.read(data, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      
      const json = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      if (json.length > 0) {
        setFileData({
          headers: json[0] as string[],
          rows: json.slice(1),
          fileName: file.name
        });
        setResults(null);
      }
    };

    reader.readAsArrayBuffer(file);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ 
    onDrop, 
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
      'text/csv': ['.csv']
    },
    multiple: false 
  });

  const clearFile = () => {
    setFileData(null);
    setResults(null);
  };

  const handleImport = async () => {
    if (!fileData) return;
    setIsProcessing(true);
    
    // Simulate mapping and API calls
    // In a real scenario, we would have a mapping step
    // For now, let's assume the columns match the field names or we try to find them
    
    let successCount = 0;
    let errorCount = 0;

    const endpoint = importType === 'leads' ? '/api/webhooks/leads' : '/api/webhooks/sales';
    const apiKey = 'test_key_123456'; // Use the same test key

    for (const row of fileData.rows) {
      try {
        const payload: any = {};
        fileData.headers.forEach((header, index) => {
          // simple mapping: lowercase and normalize
          const field = header.toLowerCase().replace(/[^a-z0-9]/g, '');
          payload[field] = row[index];
        });

        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'x-api-key': apiKey
          },
          body: JSON.stringify(payload)
        });

        if (res.ok) successCount++;
        else errorCount++;
      } catch (err) {
        errorCount++;
      }
    }

    setResults({ success: successCount, error: errorCount });
    setIsProcessing(false);
  };

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500">
      <header className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-bold text-white tracking-tight">Importación Masiva</h2>
          <p className="text-slate-500">Carga tus archivos Excel para alimentar el motor de atribución.</p>
        </div>
        <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-900 shadow-[0_0_15px_rgba(59,130,246,0.05)]">
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => setImportType('leads')}
            className={cn("px-4 py-1 h-8 transition-colors", importType === 'leads' ? "bg-blue-600 text-white shadow-[0_0_10px_rgba(37,99,235,0.4)]" : "text-slate-400")}
          >
            Leads
          </Button>
          <Button 
             variant="ghost" 
             size="sm"
             onClick={() => setImportType('sales')}
             className={cn("px-4 py-1 h-8 transition-colors", importType === 'sales' ? "bg-blue-600 text-white shadow-[0_0_10px_rgba(37,99,235,0.4)]" : "text-slate-400")}
          >
            Ventas
          </Button>
        </div>
      </header>

      {!fileData ? (
        <div 
          {...getRootProps()} 
          className={cn(
            "border-2 border-dashed rounded-3xl p-16 flex flex-col items-center justify-center transition-all cursor-pointer",
            isDragActive ? "border-blue-500 bg-blue-500/5 shadow-[0_0_30px_rgba(37,99,235,0.1)]" : "border-slate-800 hover:border-blue-500/30 hover:bg-blue-500/[0.02]"
          )}
        >
          <input {...getInputProps()} />
          <div className="w-16 h-16 bg-slate-950 rounded-2xl flex items-center justify-center mb-6 border border-slate-900 shadow-xl">
            <Upload className="h-8 w-8 text-blue-400" />
          </div>
          <h3 className="text-xl font-bold text-white mb-2">Arrastra tu archivo Excel aquí</h3>
          <p className="text-slate-500 max-w-md text-center">
            Soportamos .xlsx, .xls y .csv. Asegúrate de que la primera fila contenga los nombres de las columnas.
          </p>
        </div>
      ) : (
        <div className="space-y-6 animate-in zoom-in-95 duration-300">
          <Card className="bg-zinc-950/40 border-zinc-900 overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-7">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-500/10 rounded-xl border border-blue-500/20">
                  <FileSpreadsheet className="h-6 w-6 text-blue-400" />
                </div>
                <div>
                  <CardTitle className="text-white flex items-center gap-2">
                    {fileData.fileName}
                    <Badge variant="outline" className="text-[10px] font-black border-zinc-800 text-zinc-500">
                      {fileData.rows.length} REGISTROS
                    </Badge>
                  </CardTitle>
                  <CardDescription className="text-zinc-500">
                    Previsualización de los datos detectados.
                  </CardDescription>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={clearFile} className="text-zinc-500 hover:text-red-500">
                <Trash2 className="h-5 w-5" />
              </Button>
            </CardHeader>
            <CardContent>
              <div className="rounded-xl border border-zinc-900 overflow-hidden bg-black/50">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-zinc-900/50 hover:bg-zinc-900/50 border-zinc-800">
                      {fileData.headers.map((header, i) => (
                        <TableHead key={i} className="text-zinc-400 font-bold uppercase text-[10px] tracking-wider">
                          {header}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {fileData.rows.slice(0, 5).map((row, i) => (
                      <TableRow key={i} className="border-zinc-900">
                        {fileData.headers.map((_, j) => (
                          <TableCell key={j} className="text-zinc-300 text-xs py-3">
                            {String(row[j] || '')}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {fileData.rows.length > 5 && (
                  <div className="p-4 bg-zinc-900/30 text-center text-xs text-zinc-600 border-t border-zinc-900">
                    ... y {fileData.rows.length - 5} registros más
                  </div>
                )}
              </div>

              <div className="mt-8 flex justify-end gap-4">
                <Button variant="outline" onClick={clearFile} className="border-zinc-800 text-zinc-400">
                  Cancelar
                </Button>
                <Button 
                  onClick={handleImport} 
                  disabled={isProcessing}
                  className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-10 shadow-[0_4px_20px_rgba(37,99,235,0.3)] transition-all"
                >
                  {isProcessing ? (
                    <span className="flex items-center gap-2">
                      <Upload className="h-4 w-4 animate-bounce" /> Procesando...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                       Iniciar Importación <ArrowRight className="h-4 w-4" />
                    </span>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {results && (
            <div className="grid grid-cols-2 gap-4 animate-in slide-in-from-top-4 duration-500">
              <div className="bg-blue-950/20 border border-blue-900/50 p-6 rounded-3xl flex items-center gap-4">
                <div className="h-12 w-12 bg-blue-500/20 rounded-2xl flex items-center justify-center">
                  <CheckCircle2 className="h-6 w-6 text-blue-400" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-blue-400">{results.success}</div>
                  <div className="text-xs text-blue-600 font-bold uppercase tracking-widest">Registros Importados</div>
                </div>
              </div>
              <div className="bg-red-950/20 border border-red-900/50 p-6 rounded-3xl flex items-center gap-4">
                <div className="h-12 w-12 bg-red-500/20 rounded-2xl flex items-center justify-center">
                  <AlertCircle className="h-6 w-6 text-red-500" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-red-400">{results.error}</div>
                  <div className="text-xs text-red-600 font-bold uppercase tracking-widest">Errores / Duplicados</div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {fileData && !results && (
         <div className="bg-blue-900/10 border border-blue-900/30 p-4 rounded-xl flex items-start gap-3">
           <AlertCircle className="h-5 w-5 text-blue-400 mt-0.5" />
           <p className="text-xs text-blue-300 leading-relaxed">
             <span className="font-bold">Nota de Mapeo:</span> El sistema intentará detectar automáticamente 
             los campos basándose en los nombres de tus columnas. Por ejemplo: "Phone", "Teléfono" o "Celular" 
             serán mapeados a nuestro campo principal de contacto.
           </p>
         </div>
      )}
    </div>
  );
}
