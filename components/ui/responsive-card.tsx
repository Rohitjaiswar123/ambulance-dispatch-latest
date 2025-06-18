import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface ResponsiveCardProps {
  children?: ReactNode;
  title?: string;
  description?: string;
  className?: string;
  headerClassName?: string;
  contentClassName?: string;
  compact?: boolean;
}

export function ResponsiveCard({
  children,
  title,
  description,
  className,
  headerClassName,
  contentClassName,
  compact = false
}: ResponsiveCardProps) {
  const paddingClass = compact 
    ? "p-3 sm:p-4" 
    : "p-4 sm:p-6";

  return (
    <Card className={cn("hover:shadow-lg transition-shadow", className)}>
      {(title || description) && (
        <CardHeader className={cn(
          compact ? "pb-2 sm:pb-3" : "pb-3 sm:pb-4",
          headerClassName
        )}>
          {title && (
            <CardTitle className="text-sm sm:text-base lg:text-lg">
              {title}
            </CardTitle>
          )}
          {description && (
            <CardDescription className="text-xs sm:text-sm">
              {description}
            </CardDescription>
          )}
        </CardHeader>
      )}
      
      {children && (
        <CardContent className={cn(
          title || description ? "pt-0" : paddingClass,
          contentClassName
        )}>
          {children}
        </CardContent>
      )}
    </Card>
  );
}