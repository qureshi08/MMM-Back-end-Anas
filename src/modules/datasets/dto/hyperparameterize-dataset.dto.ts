import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsNumber, Max, Min, MinLength, IsOptional, IsString, ValidateNested } from 'class-validator';

/**
 * One channel's real settings, matching an entry in `model_configuration.channels`. Both real
 * fields are genuinely optional per-channel, confirmed by Hammad's contract 2026-09-08 — a real
 * user might set only carryover and leave saturation to Hammad's own computed default, or the
 * reverse, or neither (in which case the whole channel shouldn't be in this list at all). Real
 * validation still applies to whichever one is actually given: carryover strictly between 0 and 1,
 * saturation (an ec multiplier) strictly greater than 0.
 */
export class ChannelHyperparameterDto {
  @IsString()
  @MinLength(1)
  channel: string;

  /** 0 to 1: how much of this week's spend is still influencing next week (adstock decay). */
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  carryover?: number;

  /** How quickly this channel's effect flattens out as spend increases. A real ec multiplier, strictly greater than 0. */
  @IsOptional()
  @IsNumber()
  @Min(0.0001)
  saturation?: number;

  /**
   * True when Automatic Optimization's in-browser random draw picked this value, not the user
   * directly. Real, durable metadata now (Amna's Claude, 2026-09-08) instead of frontend-only
   * state that used to vanish on reload. Never reaches Hammad's engine — see build-job-payload.ts.
   */
  @IsOptional()
  @IsBoolean()
  carryoverEstimated?: boolean;

  @IsOptional()
  @IsBoolean()
  saturationEstimated?: boolean;
}

/**
 * The Hyperparameterization screen's real field, matching `model_configuration.channels`.
 * Genuinely optional as a whole, confirmed 2026-09-08: "no input to any channel" is a real, valid
 * choice (send an empty list, or skip this step entirely) — Hammad's own engine computes real
 * defaults for every channel not mentioned here, not just the ones we don't happen to send.
 */
export class HyperparameterizeDatasetDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChannelHyperparameterDto)
  channels: ChannelHyperparameterDto[];
}
