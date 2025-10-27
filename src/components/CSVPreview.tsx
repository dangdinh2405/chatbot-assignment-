import { useState } from "react";
import { FileText, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "./ui/button";

interface CSVPreviewProps {
  csvData: string;
  fileName: string;
}

export const CSVPreview = ({ csvData, fileName }: CSVPreviewProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const lines = csvData.split("\n").filter((line) => line.trim());
  const previewLines = lines.slice(0, 5);
  const headers = previewLines[0]?.split(",") || [];
  const rowCount = lines.length - 1;

  return (
    <div className="mb-3 border border-border rounded-lg overflow-hidden bg-secondary/50">
      <div className="flex items-center justify-between p-3 bg-secondary/80">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4" />
          <span className="font-medium text-sm">{fileName}</span>
          <span className="text-xs text-muted-foreground">({rowCount} rows)</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsExpanded(!isExpanded)}
          className="h-6 px-2"
        >
          {isExpanded ? (
            <ChevronUp className="h-3 w-3" />
          ) : (
            <ChevronDown className="h-3 w-3" />
          )}
        </Button>
      </div>

      {isExpanded && (
        <div className="p-3 overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border">
                {headers.map((header, i) => (
                  <th key={i} className="text-left p-2 font-semibold">
                    {header.trim()}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {previewLines.slice(1).map((line, i) => (
                <tr key={i} className="border-b border-border/50">
                  {line.split(",").map((cell, j) => (
                    <td key={j} className="p-2">
                      {cell.trim()}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {lines.length > 6 && (
            <p className="text-xs text-muted-foreground mt-2 text-center">
              ... and {lines.length - 6} more rows
            </p>
          )}
        </div>
      )}
    </div>
  );
};
