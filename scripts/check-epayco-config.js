const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkEpaycoConfig() {
  try {
    // Check ePayco configuration
    const { data: configs, error } = await supabase
      .from('payment_gateway_configs')
      .select('*')
      .eq('provider', 'epayco')

    if (error) {
      console.error('Error fetching ePayco config:', error)
      return
    }

    console.log('ePayco configurations found:', configs.length)
    
    configs.forEach((config, index) => {
      console.log(`\nConfig ${index + 1}:`)
      console.log('- Organization ID:', config.organization_id)
      console.log('- Provider:', config.provider)
      console.log('- Is Active:', config.is_active)
      console.log('- Is Test Mode:', config.is_test_mode)
      console.log('- Has Public Key:', !!config.public_key)
      console.log('- Has Private Key:', !!config.private_key)
      console.log('- Has Integrity Secret:', !!config.integrity_secret)
      console.log('- Has Encryption Key:', !!config.encryption_key_encrypted)
      
      if (config.public_key) {
        console.log('- Public Key (first 10 chars):', config.public_key.substring(0, 10) + '...')
      }
      if (config.integrity_secret) {
        console.log('- Customer ID (P_CUST_ID_CLIENTE):', config.integrity_secret)
      }
    })

    // Check organization
    if (configs.length > 0) {
      const { data: org, error: orgError } = await supabase
        .from('organizations')
        .select('id, name, slug')
        .eq('id', configs[0].organization_id)
        .single()

      if (orgError) {
        console.error('Error fetching organization:', orgError)
      } else {
        console.log('\nOrganization:')
        console.log('- Name:', org.name)
        console.log('- Slug:', org.slug)
      }
    }

  } catch (error) {
    console.error('Unexpected error:', error)
  }
}

checkEpaycoConfig()