import fs from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const modelsDir = path.join(process.cwd(), 'public', 'models');
    if (!fs.existsSync(modelsDir)) {
      return NextResponse.json([]);
    }
    const files = fs.readdirSync(modelsDir);
    const glbFiles = files.filter(f => f.endsWith('.glb') || f.endsWith('.gltf'));
    return NextResponse.json(glbFiles);
  } catch (err) {
    return NextResponse.json({ error: 'Failed to read models directory' }, { status: 500 });
  }
}
