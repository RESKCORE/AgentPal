"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Lock, Info } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

interface MandateFormProps {
  role: "buyer" | "seller";
  onSubmit: (mandate: {
    priceMin: number;
    priceMax: number;
    deliveryDaysMin: number;
    deliveryDaysMax: number;
    revisionsMin: number;
    revisionsMax: number;
    depositPctMin: number;
    depositPctMax: number;
  }) => void;
}

interface InputFieldProps {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  suffix?: string;
  prefix?: string;
}

function InputField({
  label,
  value,
  onChange,
  min = 0,
  max,
  suffix = "",
  prefix = "",
}: InputFieldProps) {
  return (
    <div>
      <label className="text-sm font-medium text-neutral-700 mb-2 block">
        {label}
      </label>
      <div className="relative">
        {prefix && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500">
            {prefix}
          </span>
        )}
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          min={min}
          max={max}
          className={`w-full px-4 ${prefix ? "pl-7" : ""} ${
            suffix ? "pr-10" : ""
          } py-2 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all`}
        />
        {suffix && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 text-sm">
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
}

export function MandateForm({ role, onSubmit }: MandateFormProps) {
  const [priceMin, setPriceMin] = useState(role === "buyer" ? 800 : 1000);
  const [priceMax, setPriceMax] = useState(role === "buyer" ? 1500 : 2000);
  const [deliveryMin, setDeliveryMin] = useState(role === "buyer" ? 5 : 7);
  const [deliveryMax, setDeliveryMax] = useState(role === "buyer" ? 14 : 21);
  const [revisionsMin, setRevisionsMin] = useState(role === "buyer" ? 1 : 0);
  const [revisionsMax, setRevisionsMax] = useState(role === "buyer" ? 3 : 2);
  const [depositMin, setDepositMin] = useState(role === "buyer" ? 20 : 30);
  const [depositMax, setDepositMax] = useState(role === "buyer" ? 50 : 50);

  const handleSubmit = () => {
    onSubmit({
      priceMin,
      priceMax,
      deliveryDaysMin: deliveryMin,
      deliveryDaysMax: deliveryMax,
      revisionsMin,
      revisionsMax,
      depositPctMin: depositMin,
      depositPctMax: depositMax,
    });
  };
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-2xl mx-auto"
    >
      <Card className="border-neutral-200">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center">
                  <Lock className="h-5 w-5 text-zinc-900" />
                </div>
                Set Your Private Mandate
              </CardTitle>
              <CardDescription className="mt-2">
                Your negotiation limits are private and enforced by the Settlement
                Kernel
              </CardDescription>
            </div>
            <Badge variant="secondary" className="gap-1">
              <Info className="h-3 w-3" />
              {role === "buyer" ? "Buyer" : "Seller"}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Info Alert */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
            className="p-4 rounded-xl bg-emerald-50 border border-emerald-200"
          >
            <div className="flex gap-3">
              <Lock className="h-5 w-5 text-emerald-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-emerald-900">
                <p className="font-medium mb-1">Private & Secure</p>
                <p className="text-emerald-700">
                  The other party will never see your limits. The Settlement Kernel
                  enforces them at the database level with Row Level Security.
                </p>
              </div>
            </div>
          </motion.div>

          {/* Price Range */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="space-y-4 p-4 rounded-xl bg-neutral-50"
          >
            <h3 className="font-semibold text-neutral-900">Price Range</h3>
            <div className="grid grid-cols-2 gap-4">
              <InputField
                label={role === "buyer" ? "Minimum (Floor)" : "Minimum (Accept)"}
                value={priceMin}
                onChange={setPriceMin}
                prefix="$"
              />
              <InputField
                label={role === "buyer" ? "Maximum (Ceiling)" : "Maximum (Ask)"}
                value={priceMax}
                onChange={setPriceMax}
                prefix="$"
              />
            </div>
            <div className="text-center text-sm text-neutral-600">
              Zone: {formatCurrency(priceMin)} - {formatCurrency(priceMax)}
            </div>
          </motion.div>

          {/* Delivery Days */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="space-y-4 p-4 rounded-xl bg-neutral-50"
          >
            <h3 className="font-semibold text-neutral-900">Delivery Timeline</h3>
            <div className="grid grid-cols-2 gap-4">
              <InputField
                label="Minimum Days"
                value={deliveryMin}
                onChange={setDeliveryMin}
                suffix="days"
              />
              <InputField
                label="Maximum Days"
                value={deliveryMax}
                onChange={setDeliveryMax}
                suffix="days"
              />
            </div>
          </motion.div>

          {/* Revisions */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="space-y-4 p-4 rounded-xl bg-neutral-50"
          >
            <h3 className="font-semibold text-neutral-900">Revision Rounds</h3>
            <div className="grid grid-cols-2 gap-4">
              <InputField
                label="Minimum"
                value={revisionsMin}
                onChange={setRevisionsMin}
              />
              <InputField
                label="Maximum"
                value={revisionsMax}
                onChange={setRevisionsMax}
              />
            </div>
          </motion.div>

          {/* Deposit */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="space-y-4 p-4 rounded-xl bg-neutral-50"
          >
            <h3 className="font-semibold text-neutral-900">Deposit Percentage</h3>
            <div className="grid grid-cols-2 gap-4">
              <InputField
                label="Minimum %"
                value={depositMin}
                onChange={setDepositMin}
                suffix="%"
                max={100}
              />
              <InputField
                label="Maximum %"
                value={depositMax}
                onChange={setDepositMax}
                suffix="%"
                max={100}
              />
            </div>
          </motion.div>

          {/* Submit Button */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
          >
            <Button
              onClick={handleSubmit}
              variant="success"
              size="lg"
              className="w-full gap-2"
            >
              <Lock className="h-5 w-5" />
              Seal Mandate & Begin Negotiation
            </Button>
          </motion.div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
