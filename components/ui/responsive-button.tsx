import { Button, ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface ResponsiveButtonProps extends Omit<ButtonProps, 'children'> {
  children: ReactNode;
  mobileText?: string;
  desktopText?: string;
  icon?: ReactNode;
  iconPosition?: 'left' | 'right';
  responsive?: boolean;
}

export function ResponsiveButton({
  children,
  mobileText,
  desktopText,
  icon,
  iconPosition = 'left',
  responsive = true,
  className,
  ...props
}: ResponsiveButtonProps) {
  if (!responsive) {
    return (
      <Button className={className} {...props}>
        {iconPosition === 'left' && icon}
        {children}
        {iconPosition === 'right' && icon}
      </Button>
    );
  }

  return (
    <Button 
      className={cn("text-xs sm:text-sm", className)} 
      {...props}
    >
      {iconPosition === 'left' && icon && (
        <span className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2 flex-shrink-0">
          {icon}
        </span>
      )}
      
      {mobileText && desktopText ? (
        <>
          <span className="sm:hidden">{mobileText}</span>
          <span className="hidden sm:inline">{desktopText}</span>
        </>
      ) : (
        children
      )}
      
      {iconPosition === 'right' && icon && (
        <span className="h-3 w-3 sm:h-4 sm:w-4 ml-1 sm:ml-2 flex-shrink-0">
          {icon}
        </span>
      )}
    </Button>
  );
}