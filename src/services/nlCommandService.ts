import type { NLCommand } from '../models/types';
import { db } from './database';

/**
 * Parse natural language command and extract intent and entities
 */
export function parseNLCommand(command: string): NLCommand {
  const lowerCommand = command.toLowerCase().trim();

  // Merge categories intent
  if (
    lowerCommand.includes('merge') &&
    (lowerCommand.includes('categories') || lowerCommand.includes('category'))
  ) {
    const categories = extractCategoryNames(command);
    return {
      command,
      intent: 'merge_categories',
      entities: { categories },
      confidence: categories.length >= 2 ? 0.9 : 0.5,
    };
  }

  // Create category intent
  if (
    (lowerCommand.includes('create') || lowerCommand.includes('add') || lowerCommand.includes('new')) &&
    lowerCommand.includes('category')
  ) {
    const categoryName = extractNewCategoryName(command);
    return {
      command,
      intent: 'create_category',
      entities: { categories: categoryName ? [categoryName] : [] },
      confidence: categoryName ? 0.9 : 0.5,
    };
  }

  // Move transactions intent
  if (
    lowerCommand.includes('move') &&
    (lowerCommand.includes('transaction') || lowerCommand.includes('all'))
  ) {
    const vendor = extractVendorName(command);
    const categories = extractCategoryNames(command);
    return {
      command,
      intent: 'move_transactions',
      entities: { vendor, categories },
      confidence: vendor && categories.length > 0 ? 0.9 : 0.5,
    };
  }

  // Create rule intent
  if (
    (lowerCommand.includes('always') || lowerCommand.includes('automatically')) &&
    (lowerCommand.includes('treat') || lowerCommand.includes('categorize'))
  ) {
    const vendor = extractVendorName(command);
    const categories = extractCategoryNames(command);
    return {
      command,
      intent: 'create_rule',
      entities: { vendor, categories },
      confidence: vendor && categories.length > 0 ? 0.9 : 0.5,
    };
  }

  // Set budget intent
  if (
    (lowerCommand.includes('set') || lowerCommand.includes('create')) &&
    lowerCommand.includes('budget')
  ) {
    const categories = extractCategoryNames(command);
    const amount = extractAmount(command);
    return {
      command,
      intent: 'set_budget',
      entities: { categories, amount },
      confidence: categories.length > 0 && amount ? 0.9 : 0.5,
    };
  }

  // Unknown intent
  return {
    command,
    intent: 'unknown',
    entities: {},
    confidence: 0,
  };
}

/**
 * Extract category names from command
 */
function extractCategoryNames(command: string): string[] {
  const categories: string[] = [];

  // Common patterns: "X and Y", "X, Y, and Z", etc.
  const words = command.split(/\s+/);

  // Look for quoted strings
  const quotedMatches = command.match(/"([^"]+)"/g) || command.match(/'([^']+)'/g);
  if (quotedMatches) {
    categories.push(...quotedMatches.map(m => m.replace(/['"]/g, '')));
  }

  // Look for capitalized words (likely category names)
  const capitalizedWords = words.filter(
    word => /^[A-Z][a-z]+/.test(word) && !['Create', 'Add', 'New', 'Move', 'All'].includes(word)
  );
  categories.push(...capitalizedWords);

  return [...new Set(categories)]; // Remove duplicates
}

/**
 * Extract new category name from create command
 */
function extractNewCategoryName(command: string): string | undefined {
  // Look for patterns like "called X", "named X", "category X"
  const patterns = [
    /(?:called|named)\s+["']?([^"'\n]+)["']?/i,
    /category\s+["']?([^"'\n]+)["']?/i,
  ];

  for (const pattern of patterns) {
    const match = command.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }

  return undefined;
}

/**
 * Extract vendor name from command
 */
function extractVendorName(command: string): string | undefined {
  // Look for quoted vendor names
  const quotedMatch = command.match(/"([^"]+)"/) || command.match(/'([^']+)'/);
  if (quotedMatch) {
    return quotedMatch[1];
  }

  // Look for patterns like "from X", "for X", "X transactions"
  const patterns = [
    /(?:from|for|at)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/,
    /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+transactions/,
  ];

  for (const pattern of patterns) {
    const match = command.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }

  return undefined;
}

/**
 * Extract amount from command
 */
function extractAmount(command: string): number | undefined {
  const patterns = [
    /\$(\d+(?:,\d{3})*(?:\.\d{2})?)/,
    /(\d+(?:,\d{3})*(?:\.\d{2})?)\s*dollars?/i,
  ];

  for (const pattern of patterns) {
    const match = command.match(pattern);
    if (match && match[1]) {
      return parseFloat(match[1].replace(/,/g, ''));
    }
  }

  return undefined;
}

/**
 * Execute a natural language command
 */
export async function executeNLCommand(nlCommand: NLCommand): Promise<{
  success: boolean;
  message: string;
}> {
  try {
    switch (nlCommand.intent) {
      case 'merge_categories': {
        if (!nlCommand.entities.categories || nlCommand.entities.categories.length < 2) {
          return {
            success: false,
            message: 'Please specify at least two categories to merge',
          };
        }

        const categoryNames = nlCommand.entities.categories;
        const categories = await db.categories.toArray();

        const matchedCategories = categoryNames
          .map(name =>
            categories.find(c => c.name.toLowerCase() === name.toLowerCase())
          )
          .filter(Boolean);

        if (matchedCategories.length < 2) {
          return {
            success: false,
            message: `Could not find all specified categories. Found: ${matchedCategories.map(c => c?.name).join(', ')}`,
          };
        }

        // Use first as target, rest as sources
        const target = matchedCategories[0]!;
        const sources = matchedCategories.slice(1);

        for (const source of sources) {
          if (!source) continue;
          const txns = await db.transactions.where('categoryId').equals(source.id).toArray();
          await Promise.all(
            txns.map(t =>
              db.transactions.update(t.id, {
                categoryId: target.id,
                updatedAt: new Date(),
              })
            )
          );
          await db.categories.delete(source.id);
        }

        return {
          success: true,
          message: `Merged ${sources.filter(s => s).map(s => s!.name).join(', ')} into ${target.name}`,
        };
      }

      case 'create_category': {
        const categoryName = nlCommand.entities.categories?.[0];
        if (!categoryName) {
          return {
            success: false,
            message: 'Please specify a category name',
          };
        }

        const id = `cat-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const colors = ['#10B981', '#F59E0B', '#3B82F6', '#8B5CF6', '#EC4899'];
        const color = colors[Math.floor(Math.random() * colors.length)];

        await db.categories.add({
          id,
          name: categoryName,
          color,
          isDefault: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        return {
          success: true,
          message: `Created category "${categoryName}"`,
        };
      }

      case 'move_transactions': {
        const vendor = nlCommand.entities.vendor;
        const targetCategory = nlCommand.entities.categories?.[0];

        if (!vendor || !targetCategory) {
          return {
            success: false,
            message: 'Please specify both vendor and category',
          };
        }

        const categories = await db.categories.toArray();
        const category = categories.find(
          c => c.name.toLowerCase() === targetCategory.toLowerCase()
        );

        if (!category) {
          return {
            success: false,
            message: `Category "${targetCategory}" not found`,
          };
        }

        const transactions = await db.transactions
          .filter(t => t.normalizedVendor.toLowerCase().includes(vendor.toLowerCase()))
          .toArray();

        await Promise.all(
          transactions.map(t =>
            db.transactions.update(t.id, {
              categoryId: category.id,
              confidence: 1,
              updatedAt: new Date(),
            })
          )
        );

        return {
          success: true,
          message: `Moved ${transactions.length} transaction(s) from ${vendor} to ${category.name}`,
        };
      }

      case 'create_rule': {
        const vendor = nlCommand.entities.vendor;
        const targetCategory = nlCommand.entities.categories?.[0];

        if (!vendor || !targetCategory) {
          return {
            success: false,
            message: 'Please specify both vendor and category',
          };
        }

        const categories = await db.categories.toArray();
        const category = categories.find(
          c => c.name.toLowerCase() === targetCategory.toLowerCase()
        );

        if (!category) {
          return {
            success: false,
            message: `Category "${targetCategory}" not found`,
          };
        }

        const ruleId = `rule-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        await db.rules.add({
          id: ruleId,
          type: 'vendor',
          condition: {
            field: 'normalizedVendor',
            operator: 'contains',
            value: vendor.toLowerCase(),
          },
          action: {
            type: 'categorize',
            categoryId: category.id,
          },
          priority: 100,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        return {
          success: true,
          message: `Created rule: ${vendor} → ${category.name}`,
        };
      }

      default:
        return {
          success: false,
          message: 'Sorry, I didn\'t understand that command',
        };
    }
  } catch (error) {
    return {
      success: false,
      message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}
