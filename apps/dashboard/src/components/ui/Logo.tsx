import Image from "next/image";

interface LogoProps {
  size?: "sm" | "md" | "lg";
  showText?: boolean;
}

export function Logo({ size = "md", showText = true }: LogoProps) {
  const dimensions = {
    sm: { width: 24, height: 24, textSize: "text-lg" },
    md: { width: 32, height: 32, textSize: "text-xl" },
    lg: { width: 48, height: 48, textSize: "text-2xl" },
  };

  const { width, height, textSize } = dimensions[size];

  return (
    <div className="flex items-center gap-2">
      <Image
        src="/images/logo.svg"
        alt="StratScope Logo"
        width={width}
        height={height}
        priority
      />
      {showText && (
        <span className={`${textSize} font-bold`}>
          <span className="text-blue-600">START</span>
          <span className="text-orange-500">SCOPE</span>
        </span>
      )}
    </div>
  );
}
