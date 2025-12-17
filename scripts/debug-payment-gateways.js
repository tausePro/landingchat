const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkPaymentGateways() {
  console.log('🔍 Verificando configuración de pasarelas de pago para Tez...');
  
  // 1. Verificar que existe la organización Tez
  const { data: org, error: orgError } = await supabase
    .from('organizations')
    .select('id, name, slug')
    .eq('slug', 'tez')
    .single();
    
  if (orgError) {
    console.error('❌ Error obteniendo organización:', orgError);
    return;
  }
  
  console.log('✅ Organización encontrada:', org);
  
  // 2. Verificar pasarelas configuradas
  const { data: gateways, error: gatewaysError } = await supabase
    .from('payment_gateway_configs')
    .select('*')
    .eq('organization_id', org.id);
    
  if (gatewaysError) {
    console.error('❌ Error obteniendo pasarelas:', gatewaysError);
    return;
  }
  
  console.log('📊 Pasarelas configuradas:', gateways);
  
  // 3. Verificar pasarelas activas
  const { data: activeGateways, error: activeError } = await supabase
    .from('payment_gateway_configs')
    .select('provider, is_active, is_test_mode')
    .eq('organization_id', org.id)
    .eq('is_active', true);
    
  if (activeError) {
    console.error('❌ Error obteniendo pasarelas activas:', activeError);
    return;
  }
  
  console.log('🟢 Pasarelas activas:', activeGateways);
  
  // 4. Verificar estructura de la tabla
  const { data: allConfigs, error: allError } = await supabase
    .from('payment_gateway_configs')
    .select('*')
    .limit(5);
    
  console.log('📋 Estructura de payment_gateway_configs:', allConfigs);
}

checkPaymentGateways().catch(console.error);